var SearchController = (function() {
    'use strict';

    let auth = null;
    let searchTimeout = null;
    let currentResults = {
        movies: [],
        shows: [],
        episodes: [],
        people: []
    };
    
    const focusManager = {
        currentRow: -1,  // -1 for search input, 0-3 for result rows
        currentItem: 0,
        inInput: true,
        inNavBar: false,
        navBarIndex: 0
    };

    let elements = {};

    // Search Constants
    const SEARCH_DEBOUNCE_MS = 300;
    const MIN_SEARCH_LENGTH = 2;

    /**
     * Initialize the search controller
     * Caches elements, sets up listeners, and focuses search input
     */
    function init() {
        JellyfinAPI.Logger.info('Initializing search controller...');
        
        auth = JellyfinAPI.getStoredAuth();
        if (!auth) {
            JellyfinAPI.Logger.error('No authentication found, redirecting to login');
            window.location.href = 'login.html';
            return;
        }

        JellyfinAPI.Logger.success('Authenticated as:', auth.username);
        
        cacheElements();
        setupNavbar();
        setupEventListeners();
        
        // Focus search input on load
        setTimeout(function() {
            if (elements.searchInput) {
                elements.searchInput.focus();
            }
        }, 100);
    }

    /**
     * Cache frequently accessed DOM elements for better performance
     * @private
     */
    function cacheElements() {
        elements = {
            searchInput: document.getElementById('searchInput'),
            clearBtn: document.getElementById('clearBtn'),
            emptyState: document.getElementById('emptyState'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            resultsContainer: document.getElementById('resultsContainer'),
            noResults: document.getElementById('noResults'),
            noResultsQuery: document.getElementById('noResultsQuery'),
            moviesRow: document.getElementById('moviesRow'),
            showsRow: document.getElementById('showsRow'),
            episodesRow: document.getElementById('episodesRow'),
            castRow: document.getElementById('castRow'),
            moviesList: document.getElementById('moviesList'),
            showsList: document.getElementById('showsList'),
            episodesList: document.getElementById('episodesList'),
            castList: document.getElementById('castList')
        };
    }

    /**
     * Load navbar component dynamically
     * @private
     */
    function setupNavbar() {
        const navbarScript = document.createElement('script');
        navbarScript.src = 'js/navbar.js';
        document.body.appendChild(navbarScript);
    }

    /**
     * Set up keyboard and input event listeners
     * @private
     */
    function setupEventListeners() {
        // Search input
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', handleSearchInput);
            elements.searchInput.addEventListener('keydown', handleInputKeyDown);
        }

        // Clear button
        if (elements.clearBtn) {
            elements.clearBtn.addEventListener('click', clearSearch);
        }

        // Home button navigation
        setTimeout(function() {
            const homeBtn = document.getElementById('homeBtn');
            if (homeBtn) {
                homeBtn.addEventListener('click', function() {
                    window.location.href = 'browse.html';
                });
            }
        }, 500);

        // Global keyboard navigation
        document.addEventListener('keydown', handleGlobalKeyDown);
    }

    /**
     * Handle search input changes with debouncing
     * @param {Event} evt - Input event
     * @private
     */
    function handleSearchInput(evt) {
        const query = evt.target.value.trim();
        
        JellyfinAPI.Logger.info('Search input changed:', query, 'Length:', query.length);
        
        // Show/hide clear button
        if (elements.clearBtn) {
            elements.clearBtn.style.display = query ? 'block' : 'none';
        }

        // Debounce search
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        if (query.length < MIN_SEARCH_LENGTH) {
            JellyfinAPI.Logger.info('Query too short, showing empty state');
            showEmptyState();
            return;
        }

        JellyfinAPI.Logger.info('Setting search timeout for query:', query);
        searchTimeout = setTimeout(function() {
            performSearch(query);
        }, SEARCH_DEBOUNCE_MS);
    }

    /**
     * Handle keyboard navigation when search input is focused
     * @param {KeyboardEvent} evt - Keyboard event
     * @private
     */
    function handleInputKeyDown(evt) {
        switch (evt.keyCode) {
            case KeyCodes.UP:
                evt.preventDefault();
                focusToNavBar();
                break;
            case KeyCodes.DOWN:
                evt.preventDefault();
                focusFirstResult();
                break;
            case KeyCodes.BACK:
                evt.preventDefault();
                window.location.href = 'browse.html';
                break;
        }
    }

    /**
     * Handle keyboard navigation in search results
     * @param {KeyboardEvent} evt - Keyboard event
     * @private
     */
    function handleGlobalKeyDown(evt) {
        if (focusManager.inInput) return;

        // Handle navbar navigation separately
        if (focusManager.inNavBar) {
            handleNavBarNavigation(evt);
            return;
        }

        const visibleRows = getVisibleRows();
        if (visibleRows.length === 0) return;

        switch (evt.keyCode) {
            case KeyCodes.UP:
                evt.preventDefault();
                if (focusManager.currentRow > 0) {
                    focusManager.currentRow--;
                    updateFocus();
                } else {
                    focusSearchInput();
                }
                break;

            case KeyCodes.DOWN:
                evt.preventDefault();
                if (focusManager.currentRow < visibleRows.length - 1) {
                    focusManager.currentRow++;
                    updateFocus();
                }
                break;

            case KeyCodes.LEFT:
                evt.preventDefault();
                if (focusManager.currentItem > 0) {
                    focusManager.currentItem--;
                    updateFocus();
                }
                break;

            case KeyCodes.RIGHT:
                evt.preventDefault();
                const currentRowData = getCurrentRowData();
                if (currentRowData && focusManager.currentItem < currentRowData.length - 1) {
                    focusManager.currentItem++;
                    updateFocus();
                }
                break;

            case KeyCodes.ENTER:
                evt.preventDefault();
                selectCurrentItem();
                break;

            case KeyCodes.BACK:
                evt.preventDefault();
                window.location.href = 'browse.html';
                break;
        }
    }

    /**
     * Perform search query against Jellyfin API
     * @param {string} query - Search query string
     * @private
     */
    function performSearch(query) {
        JellyfinAPI.Logger.info('Searching for:', query);
        
        showLoading();

        const endpoint = '/Users/' + auth.userId + '/Items';
        const params = {
            searchTerm: query,
            IncludeItemTypes: 'Movie,Series,Episode,Person',
            Recursive: true,
            Fields: 'PrimaryImageAspectRatio,CanDelete,MediaSourceCount',
            ImageTypeLimit: 1,
            EnableTotalRecordCount: false,
            Limit: 100
        };
        
        JellyfinAPI.Logger.info('Search API call:', auth.serverAddress + endpoint + '?searchTerm=' + query);

        JellyfinAPI.getItems(auth.serverAddress, auth.accessToken, endpoint, params, function(err, data) {
            if (err) {
                JellyfinAPI.Logger.error('Search failed:', err);
                showNoResults(query);
                return;
            }
            
            if (!data) {
                JellyfinAPI.Logger.error('No search results returned');
                showNoResults(query);
                return;
            }
            
            JellyfinAPI.Logger.info('Search API response:', data);

            processSearchResults(data.Items || [], query);
        });
    }

    /**
     * Process and categorize search results
     * @param {Object[]} items - Array of search result items
     * @param {string} query - Original search query
     * @private
     */
    function processSearchResults(items, query) {
        JellyfinAPI.Logger.info('Processing search results - Total items:', items.length);
        
        // Reset results
        currentResults = {
            movies: [],
            shows: [],
            episodes: [],
            people: []
        };

        // Categorize items
        items.forEach(function(item) {
            JellyfinAPI.Logger.info('Item:', item.Name, 'Type:', item.Type);
            
            switch (item.Type) {
                case 'Movie':
                    currentResults.movies.push(item);
                    break;
                case 'Series':
                    currentResults.shows.push(item);
                    break;
                case 'Episode':
                    currentResults.episodes.push(item);
                    break;
                case 'Person':
                    currentResults.people.push(item);
                    break;
                default:
                    JellyfinAPI.Logger.warn('Unknown item type:', item.Type, 'for item:', item.Name);
                    break;
            }
        });
        
        JellyfinAPI.Logger.info('Categorized results:', {
            movies: currentResults.movies.length,
            shows: currentResults.shows.length,
            episodes: currentResults.episodes.length,
            people: currentResults.people.length
        });

        // Check if we have any results
        const hasResults = currentResults.movies.length > 0 ||
                          currentResults.shows.length > 0 ||
                          currentResults.episodes.length > 0 ||
                          currentResults.people.length > 0;

        if (!hasResults) {
            showNoResults(query);
            return;
        }

        displayResults();
    }

    function displayResults() {
        hideAllStates();
        elements.resultsContainer.style.display = 'block';

        // Display Movies
        if (currentResults.movies.length > 0) {
            elements.moviesRow.style.display = 'block';
            renderResultCards(currentResults.movies, elements.moviesList, 'movie');
        } else {
            elements.moviesRow.style.display = 'none';
        }

        // Display TV Shows
        if (currentResults.shows.length > 0) {
            elements.showsRow.style.display = 'block';
            renderResultCards(currentResults.shows, elements.showsList, 'show');
        } else {
            elements.showsRow.style.display = 'none';
        }

        // Display Episodes
        if (currentResults.episodes.length > 0) {
            elements.episodesRow.style.display = 'block';
            renderResultCards(currentResults.episodes, elements.episodesList, 'episode');
        } else {
            elements.episodesRow.style.display = 'none';
        }

        // Display People
        if (currentResults.people.length > 0) {
            elements.castRow.style.display = 'block';
            renderResultCards(currentResults.people, elements.castList, 'person');
        } else {
            elements.castRow.style.display = 'none';
        }
    }

    function renderResultCards(items, container, type) {
        container.innerHTML = '';

        items.forEach(function(item, index) {
            const card = createResultCard(item, type, index);
            container.appendChild(card);
        });
    }

    function createResultCard(item, type, index) {
        const card = document.createElement('div');
        card.className = 'result-card' + (type === 'person' ? ' person' : '') + (type === 'episode' ? ' episode' : '');
        card.tabIndex = 0;
        card.dataset.itemId = item.Id;
        card.dataset.type = type;

        // Image wrapper
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'card-image-wrapper';

        const imageTag = item.ImageTags && item.ImageTags.Primary;
        if (imageTag) {
            const img = document.createElement('img');
            img.className = 'card-image';
            
            // Use wider images for episodes (16:9 format)
            if (type === 'episode') {
                img.src = auth.serverAddress + '/Items/' + item.Id + '/Images/Primary?fillWidth=500&quality=90';
            } else {
                img.src = auth.serverAddress + '/Items/' + item.Id + '/Images/Primary?fillWidth=300&quality=90';
            }
            
            img.alt = item.Name;
            imageWrapper.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'card-placeholder';
            placeholder.textContent = type === 'person' ? '👤' : '🎬';
            imageWrapper.appendChild(placeholder);
        }

        card.appendChild(imageWrapper);

        // Info
        const cardInfo = document.createElement('div');
        cardInfo.className = 'card-info';

        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = item.Name;
        cardInfo.appendChild(title);

        const subtitle = document.createElement('div');
        subtitle.className = 'card-subtitle';
        
        if (type === 'episode') {
            subtitle.textContent = (item.SeriesName || '') + (item.ParentIndexNumber ? ' S' + item.ParentIndexNumber : '') + 
                                  (item.IndexNumber ? 'E' + item.IndexNumber : '');
        } else if (type === 'person') {
            subtitle.textContent = item.Role || 'Actor';
        } else {
            subtitle.textContent = item.ProductionYear || '';
        }
        
        cardInfo.appendChild(subtitle);
        card.appendChild(cardInfo);

        // Event listeners
        card.addEventListener('click', function() {
            navigateToItem(item, type);
        });

        card.addEventListener('focus', function() {
            focusManager.inInput = false;
            // Scroll into view if needed
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });

        return card;
    }

    function navigateToItem(item, type) {
        if (type === 'person') {
            // Navigate to person's page (if implemented)
            JellyfinAPI.Logger.info('Person selected:', item.Name);
            return;
        }
        
        window.location.href = 'details.html?id=' + item.Id;
    }

    function getVisibleRows() {
        const rows = [];
        if (currentResults.movies.length > 0) rows.push('movies');
        if (currentResults.shows.length > 0) rows.push('shows');
        if (currentResults.episodes.length > 0) rows.push('episodes');
        if (currentResults.people.length > 0) rows.push('people');
        return rows;
    }

    function getCurrentRowData() {
        const visibleRows = getVisibleRows();
        if (focusManager.currentRow < 0 || focusManager.currentRow >= visibleRows.length) {
            return null;
        }

        const rowType = visibleRows[focusManager.currentRow];
        return currentResults[rowType];
    }

    function updateFocus() {
        const visibleRows = getVisibleRows();
        if (visibleRows.length === 0) return;

        const rowType = visibleRows[focusManager.currentRow];
        const container = getContainerForType(rowType);
        
        if (!container) return;

        const cards = container.querySelectorAll('.result-card');
        if (focusManager.currentItem >= cards.length) {
            focusManager.currentItem = cards.length - 1;
        }

        if (cards[focusManager.currentItem]) {
            cards[focusManager.currentItem].focus();
        }
    }

    function getContainerForType(type) {
        switch (type) {
            case 'movies': return elements.moviesList;
            case 'shows': return elements.showsList;
            case 'episodes': return elements.episodesList;
            case 'people': return elements.castList;
            default: return null;
        }
    }

    function focusFirstResult() {
        focusManager.inInput = false;
        focusManager.currentRow = 0;
        focusManager.currentItem = 0;
        updateFocus();
    }

    function focusSearchInput() {
        focusManager.inInput = true;
        focusManager.currentRow = -1;
        if (elements.searchInput) {
            elements.searchInput.focus();
        }
    }

    function selectCurrentItem() {
        const currentRowData = getCurrentRowData();
        if (!currentRowData || focusManager.currentItem >= currentRowData.length) {
            return;
        }

        const item = currentRowData[focusManager.currentItem];
        const visibleRows = getVisibleRows();
        const type = visibleRows[focusManager.currentRow];
        
        navigateToItem(item, type);
    }

    function clearSearch() {
        if (elements.searchInput) {
            elements.searchInput.value = '';
            elements.searchInput.focus();
        }
        if (elements.clearBtn) {
            elements.clearBtn.style.display = 'none';
        }
        showEmptyState();
    }

    function showEmptyState() {
        hideAllStates();
        elements.emptyState.style.display = 'block';
    }

    function showLoading() {
        hideAllStates();
        elements.loadingIndicator.style.display = 'block';
    }

    function showNoResults(query) {
        hideAllStates();
        elements.noResults.style.display = 'block';
        if (elements.noResultsQuery) {
            elements.noResultsQuery.textContent = 'Try searching for something else';
        }
    }

    function hideAllStates() {
        elements.emptyState.style.display = 'none';
        elements.loadingIndicator.style.display = 'none';
        elements.resultsContainer.style.display = 'none';
        elements.noResults.style.display = 'none';
    }

    /**
     * Get all navbar button elements
     * @returns {HTMLElement[]} Array of navbar button elements
     * @private
     */
    function getNavButtons() {
        return Array.from(document.querySelectorAll('.nav-left .nav-btn, .nav-center .nav-btn'));
    }

    /**
     * Move focus from search input to navbar
     * @private
     */
    function focusToNavBar() {
        focusManager.inNavBar = true;
        focusManager.inInput = false;
        const navButtons = getNavButtons();
        
        // Start at home button (index 1), not user avatar (index 0)
        focusManager.navBarIndex = navButtons.length > 1 ? 1 : 0;
        
        if (navButtons.length > 0) {
            navButtons.forEach(btn => btn.classList.remove('focused'));
            navButtons[focusManager.navBarIndex].classList.add('focused');
            navButtons[focusManager.navBarIndex].focus();
        }
    }

    /**
     * Handle keyboard navigation within navbar
     * @param {KeyboardEvent} evt - Keyboard event
     * @private
     */
    function handleNavBarNavigation(evt) {
        const navButtons = getNavButtons();
        
        navButtons.forEach(btn => btn.classList.remove('focused'));
        
        switch (evt.keyCode) {
            case KeyCodes.LEFT:
                evt.preventDefault();
                if (focusManager.navBarIndex > 0) {
                    focusManager.navBarIndex--;
                }
                navButtons[focusManager.navBarIndex].classList.add('focused');
                navButtons[focusManager.navBarIndex].focus();
                break;
                
            case KeyCodes.RIGHT:
                evt.preventDefault();
                if (focusManager.navBarIndex < navButtons.length - 1) {
                    focusManager.navBarIndex++;
                }
                navButtons[focusManager.navBarIndex].classList.add('focused');
                navButtons[focusManager.navBarIndex].focus();
                break;
                
            case KeyCodes.DOWN:
                evt.preventDefault();
                focusManager.inNavBar = false;
                focusSearchInput();
                break;
                
            case KeyCodes.ENTER:
                evt.preventDefault();
                const currentBtn = navButtons[focusManager.navBarIndex];
                if (currentBtn) {
                    currentBtn.click();
                }
                break;
        }
    }

    return {
        init: init
    };
})();

window.addEventListener('load', function() {
    SearchController.init();
});
