/*
 * Discover Controller
 * Handles Jellyseerr content discovery and browsing
 */

var DiscoverController = (function() {
    'use strict';

    var auth = null;
    var currentCategory = 'trending';
    var currentMediaType = 'all';
    var currentPage = 1;
    var totalPages = 1;
    var isLoading = false;
    
    var focusManager = {
        inNavBar: false,
        inCategoryNav: false,
        inMediaFilter: false,
        inContentGrid: false,
        inPagination: false,
        navBarIndex: 0,
        categoryIndex: 0,
        filterIndex: 0,
        gridIndex: 0,
        paginationIndex: 1, // 0=prev, 1=pageInfo, 2=next
        gridColumns: 6
    };

    var elements = {};
    
    // Timing Constants
    const FOCUS_DELAY_MS = 100;
    const BACKDROP_FADE_MS = 500;

    /**
     * Initialize the discover controller
     */
    function init() {
        auth = JellyfinAPI.getStoredAuth();
        if (!auth) {
            window.location.href = 'login.html';
            return;
        }

        cacheElements();
        
        // Check if Jellyseerr is enabled and configured
        if (!checkJellyseerrConnection()) {
            showConnectionRequired();
            return;
        }

        initializeJellyseerr();
        attachEventListeners();
        loadContent();
        
        // Initialize navbar
        if (typeof NavbarController !== 'undefined') {
            NavbarController.init('discover');
        }
        
    }

    /**
     * Cache DOM elements
     */
    function cacheElements() {
        elements.categoryNav = document.getElementById('categoryNav');
        elements.categoryBtns = document.querySelectorAll('.category-btn');
        elements.mediaTypeFilter = document.getElementById('mediaTypeFilter');
        elements.filterBtns = document.querySelectorAll('.filter-btn');
        elements.contentTitle = document.getElementById('contentTitle');
        elements.contentDescription = document.getElementById('contentDescription');
        elements.loadingIndicator = document.getElementById('loadingIndicator');
        elements.errorMessage = document.getElementById('errorMessage');
        elements.errorText = document.getElementById('errorText');
        elements.retryBtn = document.getElementById('retryBtn');
        elements.contentGrid = document.getElementById('contentGrid');
        elements.paginationControls = document.getElementById('paginationControls');
        elements.prevPageBtn = document.getElementById('prevPageBtn');
        elements.nextPageBtn = document.getElementById('nextPageBtn');
        elements.pageInfo = document.getElementById('pageInfo');
        elements.connectionRequired = document.getElementById('connectionRequired');
        elements.goToSettingsBtn = document.getElementById('goToSettingsBtn');
        elements.goBackBtn = document.getElementById('goBackBtn');
        elements.globalBackdropImage = document.getElementById('globalBackdropImage');
        elements.authRequiredModal = document.getElementById('authRequiredModal');
        elements.authNowBtn = document.getElementById('authNowBtn');
        elements.authCancelBtn = document.getElementById('authCancelBtn');
    }

    /**
     * Check if Jellyseerr is properly configured
     */
    function checkJellyseerrConnection() {
        var settings = storage.get('jellyfin_settings');
        if (!settings) return false;
        
        try {
            var parsedSettings = JSON.parse(settings);
            return parsedSettings.jellyseerrEnabled && parsedSettings.jellyseerrUrl;
        } catch (e) {
            return false;
        }
    }

    /**
     * Initialize Jellyseerr API
     */
    function initializeJellyseerr() {
        var settings = storage.get('jellyfin_settings');
        if (!settings) return;
        
        try {
            var parsedSettings = JSON.parse(settings);
            if (parsedSettings.jellyseerrUrl) {
                // Get current user ID for per-user cookie storage
                var userIdToUse = auth && auth.userId ? auth.userId : null;
                JellyseerrAPI.initialize(parsedSettings.jellyseerrUrl, null, userIdToUse);
            }
        } catch (e) {
            // Settings parsing failed, Jellyseerr will remain uninitialized
        }
    }

    /**
     * Show connection required message
     */
    function showConnectionRequired() {
        if (elements.connectionRequired) {
            elements.connectionRequired.style.display = 'flex';
        }
        
        // Focus the first button
        setTimeout(function() {
            if (elements.goToSettingsBtn) {
                elements.goToSettingsBtn.focus();
            }
        }, 100);
        
        document.addEventListener('keydown', handleConnectionRequiredNavigation);
    }

    /**
     * Handle navigation in connection required screen
     */
    function handleConnectionRequiredNavigation(evt) {
        if (evt.keyCode === KeyCodes.BACK) {
            evt.preventDefault();
            window.location.href = 'browse.html';
            return;
        }
        
        if (evt.keyCode === KeyCodes.ENTER) {
            if (document.activeElement === elements.goToSettingsBtn) {
                window.location.href = 'settings.html';
            } else if (document.activeElement === elements.goBackBtn) {
                window.location.href = 'browse.html';
            }
        }
        
        // Left/Right navigation between buttons
        if (evt.keyCode === KeyCodes.RIGHT) {
            if (document.activeElement === elements.goToSettingsBtn && elements.goBackBtn) {
                evt.preventDefault();
                elements.goBackBtn.focus();
            }
        } else if (evt.keyCode === KeyCodes.LEFT) {
            if (document.activeElement === elements.goBackBtn && elements.goToSettingsBtn) {
                evt.preventDefault();
                elements.goToSettingsBtn.focus();
            }
        }
    }

    /**
     * Attach event listeners
     */
    function attachEventListeners() {
        document.addEventListener('keydown', handleKeyPress);
        
        // Category buttons
        elements.categoryBtns.forEach(function(btn, index) {
            btn.addEventListener('click', function() {
                selectCategory(btn.dataset.category);
            });
        });
        
        // Media type filter buttons
        elements.filterBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                selectMediaType(btn.dataset.type);
            });
        });
        
        // Pagination buttons
        if (elements.prevPageBtn) {
            elements.prevPageBtn.addEventListener('click', previousPage);
        }
        if (elements.nextPageBtn) {
            elements.nextPageBtn.addEventListener('click', nextPage);
        }
        
        // Retry button
        if (elements.retryBtn) {
            elements.retryBtn.addEventListener('click', function() {
                loadContent();
            });
        }
        
        // Connection required buttons
        if (elements.goToSettingsBtn) {
            elements.goToSettingsBtn.addEventListener('click', function() {
                window.location.href = 'settings.html';
            });
        }
        if (elements.goBackBtn) {
            elements.goBackBtn.addEventListener('click', function() {
                window.location.href = 'browse.html';
            });
        }
        
        // Auth required modal buttons
        if (elements.authNowBtn) {
            elements.authNowBtn.addEventListener('click', function() {
                closeAuthModal();
                window.location.href = 'settings.html#jellyseerr';
            });
        }
        if (elements.authCancelBtn) {
            elements.authCancelBtn.addEventListener('click', function() {
                closeAuthModal();
                window.location.href = 'browse.html';
            });
        }
    }

    /**
     * Show authentication required modal
     */
    function showAuthModal() {
        if (elements.authRequiredModal) {
            elements.authRequiredModal.style.display = 'flex';
            if (elements.authNowBtn) {
                elements.authNowBtn.focus();
            }
        }
    }
    
    /**
     * Close authentication required modal
     */
    function closeAuthModal() {
        if (elements.authRequiredModal) {
            elements.authRequiredModal.style.display = 'none';
        }
    }

    /**
     * Handle keyboard navigation
     */
    function handleKeyPress(evt) {
        // Handle auth modal navigation
        if (elements.authRequiredModal && elements.authRequiredModal.style.display === 'flex') {
            if (evt.keyCode === KeyCodes.BACK) {
                evt.preventDefault();
                closeAuthModal();
                window.location.href = 'browse.html';
                return;
            }
            if (evt.keyCode === KeyCodes.LEFT || evt.keyCode === KeyCodes.RIGHT) {
                evt.preventDefault();
                // Toggle focus between buttons
                if (document.activeElement === elements.authNowBtn) {
                    elements.authCancelBtn.focus();
                } else {
                    elements.authNowBtn.focus();
                }
                return;
            }
            if (evt.keyCode === KeyCodes.ENTER) {
                // Let the button's click handler take care of it
                return;
            }
            return; // Don't handle other keys when modal is open
        }
        
        if (evt.keyCode === KeyCodes.BACK) {
            evt.preventDefault();
            if (!focusManager.inNavBar && !focusManager.inCategoryNav) {
                focusToCategoryNav();
            } else if (focusManager.inCategoryNav) {
                focusToNavBar();
            } else if (focusManager.inNavBar) {
                window.location.href = 'browse.html';
            }
            return;
        }
        
        if (focusManager.inNavBar) {
            handleNavBarNavigation(evt);
        } else if (focusManager.inCategoryNav) {
            handleCategoryNavigation(evt);
        } else if (focusManager.inMediaFilter) {
            handleFilterNavigation(evt);
        } else if (focusManager.inContentGrid) {
            handleGridNavigation(evt);
        } else if (focusManager.inPagination) {
            handlePaginationNavigation(evt);
        }
    }

    /**
     * Handle navbar navigation
     */
    function handleNavBarNavigation(evt) {
        var navButtons = Array.from(document.querySelectorAll('.nav-left .nav-btn, .nav-center .nav-btn'));
        
        navButtons.forEach(function(btn) {
            btn.classList.remove('focused');
        });
        
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
                focusToCategoryNav();
                break;
                
            case KeyCodes.ENTER:
                evt.preventDefault();
                var currentBtn = navButtons[focusManager.navBarIndex];
                if (currentBtn) {
                    currentBtn.click();
                }
                break;
        }
    }

    /**
     * Handle category navigation
     */
    function handleCategoryNavigation(evt) {
        var categories = Array.from(elements.categoryBtns);
        
        switch (evt.keyCode) {
            case KeyCodes.LEFT:
                evt.preventDefault();
                if (focusManager.categoryIndex > 0) {
                    focusManager.categoryIndex--;
                    updateCategoryFocus(categories);
                }
                break;
                
            case KeyCodes.RIGHT:
                evt.preventDefault();
                if (focusManager.categoryIndex < categories.length - 1) {
                    focusManager.categoryIndex++;
                    updateCategoryFocus(categories);
                }
                break;
                
            case KeyCodes.UP:
                evt.preventDefault();
                focusToNavBar();
                break;
                
            case KeyCodes.DOWN:
                evt.preventDefault();
                focusToContentGrid();
                break;
                
            case KeyCodes.ENTER:
                evt.preventDefault();
                var selectedCategory = categories[focusManager.categoryIndex];
                if (selectedCategory) {
                    selectCategory(selectedCategory.dataset.category);
                }
                break;
        }
    }

    /**
     * Handle filter navigation
     */
    function handleFilterNavigation(evt) {
        var filters = Array.from(elements.filterBtns);
        
        switch (evt.keyCode) {
            case KeyCodes.LEFT:
                evt.preventDefault();
                if (focusManager.filterIndex > 0) {
                    focusManager.filterIndex--;
                    updateFilterFocus(filters);
                }
                break;
                
            case KeyCodes.RIGHT:
                evt.preventDefault();
                if (focusManager.filterIndex < filters.length - 1) {
                    focusManager.filterIndex++;
                    updateFilterFocus(filters);
                }
                break;
                
            case KeyCodes.UP:
                evt.preventDefault();
                focusToCategoryNav();
                break;
                
            case KeyCodes.DOWN:
                evt.preventDefault();
                focusToContentGrid();
                break;
                
            case KeyCodes.ENTER:
                evt.preventDefault();
                var selectedFilter = filters[focusManager.filterIndex];
                if (selectedFilter) {
                    selectMediaType(selectedFilter.dataset.type);
                }
                break;
        }
    }

    /**
     * Handle content grid navigation
     */
    function handleGridNavigation(evt) {
        var cards = Array.from(document.querySelectorAll('.content-card'));
        if (cards.length === 0) return;
        
        var currentRow = Math.floor(focusManager.gridIndex / focusManager.gridColumns);
        var currentCol = focusManager.gridIndex % focusManager.gridColumns;
        var totalRows = Math.ceil(cards.length / focusManager.gridColumns);
        
        switch (evt.keyCode) {
            case KeyCodes.LEFT:
                evt.preventDefault();
                if (currentCol > 0) {
                    focusManager.gridIndex--;
                    updateGridFocus(cards);
                }
                break;
                
            case KeyCodes.RIGHT:
                evt.preventDefault();
                if (currentCol < focusManager.gridColumns - 1 && focusManager.gridIndex < cards.length - 1) {
                    focusManager.gridIndex++;
                    updateGridFocus(cards);
                }
                break;
                
            case KeyCodes.UP:
                evt.preventDefault();
                if (currentRow > 0) {
                    focusManager.gridIndex -= focusManager.gridColumns;
                    if (focusManager.gridIndex < 0) focusManager.gridIndex = 0;
                    updateGridFocus(cards);
                } else {
                    focusToCategoryNav();
                }
                break;
                
            case KeyCodes.DOWN:
                evt.preventDefault();
                if (currentRow < totalRows - 1) {
                    focusManager.gridIndex += focusManager.gridColumns;
                    if (focusManager.gridIndex >= cards.length) {
                        focusManager.gridIndex = cards.length - 1;
                    }
                    updateGridFocus(cards);
                } else if (totalPages > 1) {
                    focusToPagination();
                }
                break;
                
            case KeyCodes.ENTER:
                evt.preventDefault();
                var selectedCard = cards[focusManager.gridIndex];
                if (selectedCard) {
                    var mediaId = selectedCard.dataset.mediaId;
                    var mediaType = selectedCard.dataset.mediaType;
                    if (mediaId && mediaType) {
                        openMediaDetails(mediaId, mediaType);
                    }
                }
                break;
        }
    }

    /**
     * Handle pagination navigation
     */
    function handlePaginationNavigation(evt) {
        var buttons = [elements.prevPageBtn, elements.pageInfo, elements.nextPageBtn];
        
        switch (evt.keyCode) {
            case KeyCodes.LEFT:
                evt.preventDefault();
                if (focusManager.paginationIndex > 0) {
                    focusManager.paginationIndex--;
                    updatePaginationFocus(buttons);
                }
                break;
                
            case KeyCodes.RIGHT:
                evt.preventDefault();
                if (focusManager.paginationIndex < 2) {
                    focusManager.paginationIndex++;
                    updatePaginationFocus(buttons);
                }
                break;
                
            case KeyCodes.UP:
                evt.preventDefault();
                focusToContentGrid();
                break;
                
            case KeyCodes.ENTER:
                evt.preventDefault();
                if (focusManager.paginationIndex === 0 && !elements.prevPageBtn.disabled) {
                    previousPage();
                } else if (focusManager.paginationIndex === 2 && !elements.nextPageBtn.disabled) {
                    nextPage();
                }
                break;
        }
    }

    /**
     * Focus management functions
     */
    function focusToNavBar() {
        focusManager.inNavBar = true;
        focusManager.inCategoryNav = false;
        focusManager.inMediaFilter = false;
        focusManager.inContentGrid = false;
        focusManager.inPagination = false;
        
        var navButtons = Array.from(document.querySelectorAll('.nav-left .nav-btn, .nav-center .nav-btn'));
        if (navButtons.length > 0) {
            navButtons.forEach(function(btn) { btn.classList.remove('focused'); });
            navButtons[focusManager.navBarIndex].classList.add('focused');
            navButtons[focusManager.navBarIndex].focus();
        }
    }

    function focusToCategoryNav() {
        focusManager.inNavBar = false;
        focusManager.inCategoryNav = true;
        focusManager.inMediaFilter = false;
        focusManager.inContentGrid = false;
        focusManager.inPagination = false;
        
        var categories = Array.from(elements.categoryBtns);
        updateCategoryFocus(categories);
    }

    function focusToContentGrid() {
        focusManager.inNavBar = false;
        focusManager.inCategoryNav = false;
        focusManager.inMediaFilter = false;
        focusManager.inContentGrid = true;
        focusManager.inPagination = false;
        
        var cards = Array.from(document.querySelectorAll('.content-card'));
        if (cards.length > 0) {
            if (focusManager.gridIndex >= cards.length) {
                focusManager.gridIndex = 0;
            }
            updateGridFocus(cards);
        }
    }

    function focusToPagination() {
        focusManager.inNavBar = false;
        focusManager.inCategoryNav = false;
        focusManager.inMediaFilter = false;
        focusManager.inContentGrid = false;
        focusManager.inPagination = true;
        
        var buttons = [elements.prevPageBtn, elements.pageInfo, elements.nextPageBtn];
        updatePaginationFocus(buttons);
    }

    function updateCategoryFocus(categories) {
        categories.forEach(function(cat, index) {
            if (index === focusManager.categoryIndex) {
                cat.classList.add('focused');
                cat.focus();
                cat.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else {
                cat.classList.remove('focused');
            }
        });
    }

    function updateFilterFocus(filters) {
        filters.forEach(function(filter, index) {
            if (index === focusManager.filterIndex) {
                filter.classList.add('focused');
                filter.focus();
            } else {
                filter.classList.remove('focused');
            }
        });
    }

    function updateGridFocus(cards) {
        cards.forEach(function(card, index) {
            if (index === focusManager.gridIndex) {
                card.classList.add('focused');
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Update backdrop with focused item
                var backdropUrl = card.dataset.backdropUrl;
                if (backdropUrl) {
                    updateBackdrop(backdropUrl);
                }
            } else {
                card.classList.remove('focused');
            }
        });
    }

    function updatePaginationFocus(buttons) {
        buttons.forEach(function(btn, index) {
            if (index === focusManager.paginationIndex) {
                if (btn.classList) {
                    btn.classList.add('focused');
                    if (btn.focus) btn.focus();
                }
            } else {
                if (btn.classList) {
                    btn.classList.remove('focused');
                }
            }
        });
    }

    /**
     * Select a category
     */
    function selectCategory(category) {
        currentCategory = category;
        currentPage = 1;
        
        // Update active category button
        elements.categoryBtns.forEach(function(btn) {
            if (btn.dataset.category === category) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Update title and description
        updateContentHeader(category);
        
        // Load content
        loadContent();
    }

    /**
     * Select media type filter
     */
    function selectMediaType(type) {
        currentMediaType = type;
        currentPage = 1;
        
        // Update active filter button
        elements.filterBtns.forEach(function(btn) {
            if (btn.dataset.type === type) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Load content
        loadContent();
    }

    /**
     * Update content header based on category
     */
    function updateContentHeader(category) {
        var titles = {
            trending: { title: 'Trending Now', desc: 'Discover what\'s popular right now' },
            popular: { title: 'Most Popular', desc: 'Top rated content of all time' },
            upcoming: { title: 'Coming Soon', desc: 'Upcoming releases and new content' },
            requests: { title: 'My Requests', desc: 'View and manage your content requests' },
            movies: { title: 'Movies', desc: 'Browse the movie collection' },
            tv: { title: 'TV Shows', desc: 'Explore television series' }
        };
        
        var content = titles[category] || titles.trending;
        elements.contentTitle.textContent = content.title;
        elements.contentDescription.textContent = content.desc;
    }

    /**
     * Load content based on current category and filters
     */
    function loadContent() {
        if (isLoading) return;
        
        // Check if Jellyseerr is authenticated
        if (!JellyseerrAPI.isAuthenticated()) {
            // Try auto-login first
            JellyseerrAPI.attemptAutoLogin()
                .then(function(success) {
                    if (success) {
                        // Auto-login succeeded, proceed with loading
                        continueLoadingContent();
                    } else {
                        // Show auth modal instead of error
                        showAuthModal();
                    }
                })
                .catch(function(error) {
                    showAuthModal();
                });
            return;
        }
        
        // Already authenticated, proceed
        continueLoadingContent();
    }
    
    /**
     * Continue loading content after authentication is verified
     */
    function continueLoadingContent() {
        
        isLoading = true;
        showLoading();
        hideError();
        
        var options = {
            page: currentPage,
            language: 'en'
        };
        
        var apiCall;
        
        switch (currentCategory) {
            case 'trending':
                apiCall = JellyseerrAPI.getTrending(options);
                break;
            case 'popular':
                apiCall = JellyseerrAPI.getTopMovies(options);
                break;
            case 'upcoming':
                apiCall = JellyseerrAPI.getUpcomingMovies(options);
                break;
            case 'requests':
                // Load user's requests
                apiCall = loadUserRequests(options);
                break;
            case 'movies':
                apiCall = JellyseerrAPI.getTrendingMovies(options);
                break;
            case 'tv':
                apiCall = JellyseerrAPI.getTrendingTv(options);
                break;
            default:
                apiCall = JellyseerrAPI.getTrending(options);
        }
        
        apiCall
            .then(function(response) {
                isLoading = false;
                hideLoading();
                
                currentPage = response.page || 1;
                totalPages = response.totalPages || 1;
                
                renderContent(response.results || []);
                updatePagination();
                
                // Focus on first item
                setTimeout(function() {
                    focusToContentGrid();
                }, FOCUS_DELAY_MS);
            })
            .catch(function(error) {
                isLoading = false;
                hideLoading();
                showError('Failed to load content. Please check your connection and try again.');
            });
    }

    /**
     * Render content cards
     */
    function renderContent(items) {
        elements.contentGrid.innerHTML = '';
        
        if (items.length === 0) {
            elements.contentGrid.innerHTML = '<div class="no-content">No content available</div>';
            return;
        }
        
        items.forEach(function(item) {
            var card = createContentCard(item);
            elements.contentGrid.appendChild(card);
        });
    }

    /**
     * Create a content card element
     */
    function createContentCard(item) {
        var card = document.createElement('div');
        card.className = 'content-card';
        card.dataset.mediaId = item.id;
        card.dataset.mediaType = item.mediaType;
        card.dataset.backdropUrl = item.backdropUrl || '';
        card.tabIndex = 0;
        
        var posterUrl = item.posterUrl || '';
        var title = item.title || item.name || 'Unknown';
        var year = item.releaseYear || '';
        var rating = item.voteAverage ? (Math.round(item.voteAverage * 10) / 10) : '';
        
        card.innerHTML = 
            '<div class="card-poster">' +
                (posterUrl ? '<img src="' + posterUrl + '" alt="' + title + '" loading="lazy">' : '<div class="poster-placeholder">No Image</div>') +
            '</div>' +
            '<div class="card-info">' +
                '<h3 class="card-title">' + title + '</h3>' +
                '<div class="card-meta">' +
                    (year ? '<span class="card-year">' + year + '</span>' : '') +
                    (rating ? '<span class="card-rating">⭐ ' + rating + '</span>' : '') +
                '</div>' +
            '</div>';
        
        return card;
    }

    /**
     * Open media details page
     */
    function openMediaDetails(mediaId, mediaType) {
        window.location.href = 'details.html?type=' + mediaType + '&id=' + mediaId + '&source=jellyseerr';
    }

    /**
     * Update backdrop image
     */
    function updateBackdrop(url) {
        if (!url || !elements.globalBackdropImage) return;
        
        elements.globalBackdropImage.src = url;
        elements.globalBackdropImage.style.display = 'block';
        elements.globalBackdropImage.style.opacity = '1';
    }

    /**
     * Pagination functions
     */
    function updatePagination() {
        if (totalPages <= 1) {
            elements.paginationControls.style.display = 'none';
            return;
        }
        
        elements.paginationControls.style.display = 'flex';
        elements.pageInfo.textContent = 'Page ' + currentPage + ' of ' + totalPages;
        
        elements.prevPageBtn.disabled = currentPage <= 1;
        elements.nextPageBtn.disabled = currentPage >= totalPages;
    }

    /**
     * Load user's requests and convert them to discover item format
     */
    function loadUserRequests(options) {
        // First get current user
        return JellyseerrAPI.getCurrentUser()
            .then(function(user) {
                // Get requests filtered by this user
                return JellyseerrAPI.getRequests({
                    filter: 'all',
                    requestedBy: user.id,
                    limit: options.limit || 20,
                    offset: ((options.page || 1) - 1) * (options.limit || 20)
                });
            })
            .then(function(response) {
                // Convert requests to discover item format
                var items = response.results.map(function(request) {
                    var media = request.media || {};
                    return {
                        id: media.tmdbId || media.id || request.id,
                        mediaType: request.type || 'movie',
                        title: media.title || media.name || 'Unknown',
                        name: media.name || media.title,
                        posterUrl: media.posterPath ? ImageHelper.getTMDBImageUrl(media.posterPath, 'w500') : null,
                        backdropUrl: media.backdropPath ? ImageHelper.getTMDBImageUrl(media.backdropPath, 'original') : null,
                        overview: media.overview || '',
                        releaseYear: (media.releaseDate || media.firstAirDate || '').substring(0, 4),
                        voteAverage: media.voteAverage || 0,
                        // Include request status info
                        requestStatus: request.status,
                        requestId: request.id
                    };
                });

                // Return in same format as other API calls
                return {
                    results: items,
                    page: response.pageInfo ? response.pageInfo.page : 1,
                    totalPages: response.pageInfo ? response.pageInfo.pages : 1,
                    totalResults: response.pageInfo ? response.pageInfo.results : items.length
                };
            });
    }

    function previousPage() {
        if (currentPage > 1) {
            currentPage--;
            loadContent();
        }
    }

    function nextPage() {
        if (currentPage < totalPages) {
            currentPage++;
            loadContent();
        }
    }

    /**
     * UI helper functions
     */
    function showLoading() {
        elements.loadingIndicator.style.display = 'flex';
        elements.contentGrid.style.display = 'none';
    }

    function hideLoading() {
        elements.loadingIndicator.style.display = 'none';
        elements.contentGrid.style.display = 'grid';
    }

    function showError(message) {
        elements.errorText.textContent = message;
        elements.errorMessage.style.display = 'flex';
        elements.contentGrid.style.display = 'none';
    }

    function hideError() {
        elements.errorMessage.style.display = 'none';
    }

    return {
        init: init
    };
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', DiscoverController.init);
} else {
    DiscoverController.init();
}
