/*
 * Discover Controller (Row-based Layout)
 * Handles Jellyseerr content discovery with horizontal rows
 */

var DiscoverController = (function() {
    'use strict';

    var auth = null;
    var isLoading = false;
    
    // Focus management for row-based navigation
    var focusManager = {
        inNavBar: false,
        inRows: true,
        navBarIndex: 0,
        currentRowIndex: 0,
        currentItemIndex: 0,
        rows: []
    };

    var elements = {};
    
    // Row configuration
    var rowConfigs = [
        { id: 'trending', title: 'Trending Now', apiMethod: 'getTrending', type: 'all' },
        { id: 'popularMovies', title: 'Popular Movies', apiMethod: 'getTrendingMovies', type: 'movie' },
        { id: 'popularTv', title: 'Popular TV Shows', apiMethod: 'getTrendingTv', type: 'tv' },
        { id: 'upcomingMovies', title: 'Upcoming Movies', apiMethod: 'getUpcomingMovies', type: 'movie' },
        { id: 'upcomingTv', title: 'Upcoming TV Shows', apiMethod: 'getUpcomingTv', type: 'tv' },
        { id: 'requests', title: 'My Requests', apiMethod: 'getRequests', type: 'requests' }
    ];
    
    // Store loaded data
    var rowData = {};
    
    // Backdrop update debouncing
    var backdropUpdateTimer = null;
    const BACKDROP_UPDATE_DELAY = 300;

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
        loadAllRows();
        
        // Initialize navbar
        if (typeof NavbarController !== 'undefined') {
            NavbarController.init('discover');
        }
        
        // Start with first row focused
        setTimeout(function() {
            focusToFirstRow();
        }, 500);
        
    }

    /**
     * Cache DOM elements
     */
    function cacheElements() {
        elements.rowsContainer = document.getElementById('rowsContainer');
        elements.loadingIndicator = document.getElementById('loadingIndicator');
        elements.errorMessage = document.getElementById('errorMessage');
        elements.errorText = document.getElementById('errorText');
        elements.retryBtn = document.getElementById('retryBtn');
        elements.connectionRequired = document.getElementById('connectionRequired');
        elements.goToSettingsBtn = document.getElementById('goToSettingsBtn');
        elements.goBackBtn = document.getElementById('goBackBtn');
        elements.globalBackdropImage = document.getElementById('globalBackdropImage');
        
        // Cache row elements
        rowConfigs.forEach(function(config) {
            elements[config.id + 'Row'] = document.getElementById(config.id + 'Row');
            elements[config.id + 'Items'] = document.getElementById(config.id + 'Items');
        });
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
        
        setTimeout(function() {
            if (elements.goToSettingsBtn) {
                elements.goToSettingsBtn.focus();
            }
        }, 100);
    }

    /**
     * Attach event listeners
     */
    function attachEventListeners() {
        document.addEventListener('keydown', handleKeyPress);
        
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
        
        // Retry button
        if (elements.retryBtn) {
            elements.retryBtn.addEventListener('click', function() {
                loadAllRows();
            });
        }
    }

    /**
     * Load all rows on initialization
     */
    function loadAllRows() {
        if (isLoading) return;
        
        isLoading = true;
        showLoading();
        
        var promises = rowConfigs.map(function(config) {
            return loadRowContent(config);
        });
        
        Promise.all(promises)
            .then(function() {
                hideLoading();
                isLoading = false;
                buildFocusableItemsCache();
            })
            .catch(function(error) {
                hideLoading();
                isLoading = false;
                showError('Failed to load content. Please try again.');
            });
    }

    /**
     * Load content for a specific row
     */
    function loadRowContent(config) {
        return new Promise(function(resolve, reject) {
            var apiMethod = JellyseerrAPI[config.apiMethod];
            
            if (!apiMethod) {
                resolve();
                return;
            }
            
            apiMethod.call(JellyseerrAPI, 1) // Load first page only
                .then(function(response) {
                    var results = response.results || response || [];
                    
                    // Filter NSFW content
                    results = filterNSFW(results);
                    
                    rowData[config.id] = results;
                    renderRow(config.id, results);
                    resolve();
                })
                .catch(function(error) {
                    // If it's the requests row and fails (likely due to auth), just skip it
                    if (config.id === 'requests') {
                        hideRow(config.id);
                        resolve();
                    } else {
                        reject(error);
                    }
                });
        });
    }

    /**
     * Filter NSFW content based on settings
     */
    function filterNSFW(items) {
        var settings = storage.get('jellyfin_settings');
        var filterNSFW = true; // Default to filtering
        
        try {
            var parsedSettings = JSON.parse(settings);
            if (parsedSettings.jellyseerrFilterNSFW !== undefined) {
                filterNSFW = parsedSettings.jellyseerrFilterNSFW;
            }
        } catch (e) {
            // Use default
        }
        
        if (!filterNSFW) {
            return items; // Don't filter
        }
        
        return items.filter(function(item) {
            // Filter by adult flag
            if (item.adult === true) {
                return false;
            }
            
            // TODO: Add keyword blacklist filtering if needed
            
            return true;
        });
    }

    /**
     * Render a row with items
     */
    function renderRow(rowId, items) {
        var container = elements[rowId + 'Items'];
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!items || items.length === 0) {
            hideRow(rowId);
            return;
        }
        
        items.forEach(function(item, index) {
            var card = createMediaCard(item, rowId, index);
            container.appendChild(card);
        });
    }

    /**
     * Hide a row if it has no content
     */
    function hideRow(rowId) {
        var row = elements[rowId + 'Row'];
        if (row) {
            row.style.display = 'none';
        }
    }

    /**
     * Create a media card element
     */
    function createMediaCard(item, rowId, index) {
        var card = document.createElement('div');
        card.className = 'content-card';
        card.dataset.rowId = rowId;
        card.dataset.itemIndex = index;
        card.dataset.mediaId = item.id;
        card.dataset.mediaType = item.mediaType || 'movie';
        card.tabIndex = 0;
        
        var poster = document.createElement('div');
        poster.className = 'card-poster';
        
        if (item.posterPath) {
            var img = document.createElement('img');
            img.src = ImageHelper.getTMDBImageUrl(item.posterPath, 'w500');
            img.alt = item.title || item.name || 'Media poster';
            img.onerror = function() {
                this.style.display = 'none';
            };
            poster.appendChild(img);
        }
        
        // Add request status indicator if available
        if (item.mediaInfo && item.mediaInfo.status) {
            var statusBadge = document.createElement('div');
            statusBadge.className = 'status-badge status-' + item.mediaInfo.status;
            statusBadge.textContent = getStatusText(item.mediaInfo.status);
            poster.appendChild(statusBadge);
        }
        
        card.appendChild(poster);
        
        // Add click handler
        card.addEventListener('click', function() {
            openDetails(item);
        });
        
        // Add focus handler for backdrop update
        card.addEventListener('focus', function() {
            updateBackdrop(item);
        });
        
        return card;
    }

    /**
     * Get status text from status code
     */
    function getStatusText(status) {
        var statusMap = {
            1: 'Pending',
            2: 'Processing',
            3: 'Available',
            4: 'Partially Available',
            5: 'Available'
        };
        return statusMap[status] || '';
    }

    /**
     * Update global backdrop
     */
    function updateBackdrop(item) {
        if (backdropUpdateTimer) {
            clearTimeout(backdropUpdateTimer);
        }
        
        backdropUpdateTimer = setTimeout(function() {
            if (!item.backdropPath) return;
            
            var backdropUrl = ImageHelper.getTMDBImageUrl(item.backdropPath, 'original');
            
            if (elements.globalBackdropImage) {
                elements.globalBackdropImage.src = backdropUrl;
                elements.globalBackdropImage.style.display = 'block';
                elements.globalBackdropImage.style.opacity = '1';
            }
        }, BACKDROP_UPDATE_DELAY);
    }

    /**
     * Open details page for an item
     */
    function openDetails(item) {
        var mediaType = item.mediaType || 'movie';
        var mediaId = item.id;
        window.location.href = 'details.html?type=' + mediaType + '&id=' + mediaId;
    }

    /**
     * Build cache of focusable items for navigation
     */
    function buildFocusableItemsCache() {
        focusManager.rows = [];
        
        rowConfigs.forEach(function(config) {
            var container = elements[config.id + 'Items'];
            if (!container || container.parentElement.style.display === 'none') return;
            
            var cards = container.querySelectorAll('.content-card');
            if (cards.length > 0) {
                focusManager.rows.push({
                    id: config.id,
                    cards: Array.from(cards)
                });
            }
        });
    }

    /**
     * Focus to first row
     */
    function focusToFirstRow() {
        if (focusManager.rows.length === 0) return;
        
        focusManager.inNavBar = false;
        focusManager.inRows = true;
        focusManager.currentRowIndex = 0;
        focusManager.currentItemIndex = 0;
        
        updateFocus();
    }

    /**
     * Focus to navbar
     */
    function focusToNavBar() {
        focusManager.inNavBar = true;
        focusManager.inRows = false;
        
        var navButtons = document.querySelectorAll('.nav-left .nav-btn, .nav-center .nav-btn');
        if (navButtons.length > 0) {
            navButtons[focusManager.navBarIndex].focus();
        }
    }

    /**
     * Update focus on current item
     */
    function updateFocus() {
        // Remove all focused classes
        document.querySelectorAll('.content-card.focused').forEach(function(card) {
            card.classList.remove('focused');
        });
        
        if (!focusManager.inRows) return;
        
        var currentRow = focusManager.rows[focusManager.currentRowIndex];
        if (!currentRow) return;
        
        var currentCard = currentRow.cards[focusManager.currentItemIndex];
        if (!currentCard) return;
        
        currentCard.classList.add('focused');
        currentCard.focus();
        
        // Scroll card into view horizontally
        currentCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    /**
     * Handle keyboard navigation
     */
    function handleKeyPress(evt) {
        if (evt.keyCode === KeyCodes.BACK) {
            evt.preventDefault();
            if (focusManager.inRows) {
                focusToNavBar();
            } else if (focusManager.inNavBar) {
                window.location.href = 'browse.html';
            }
            return;
        }
        
        if (focusManager.inNavBar) {
            handleNavBarNavigation(evt);
        } else if (focusManager.inRows) {
            handleRowNavigation(evt);
        }
    }

    /**
     * Handle navbar navigation
     */
    function handleNavBarNavigation(evt) {
        var navButtons = Array.from(document.querySelectorAll('.nav-left .nav-btn, .nav-center .nav-btn'));
        
        switch (evt.keyCode) {
            case KeyCodes.LEFT:
                evt.preventDefault();
                if (focusManager.navBarIndex > 0) {
                    focusManager.navBarIndex--;
                    navButtons[focusManager.navBarIndex].focus();
                }
                break;
                
            case KeyCodes.RIGHT:
                evt.preventDefault();
                if (focusManager.navBarIndex < navButtons.length - 1) {
                    focusManager.navBarIndex++;
                    navButtons[focusManager.navBarIndex].focus();
                }
                break;
                
            case KeyCodes.DOWN:
                evt.preventDefault();
                focusToFirstRow();
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
     * Handle row-based navigation
     */
    function handleRowNavigation(evt) {
        if (focusManager.rows.length === 0) return;
        
        var currentRow = focusManager.rows[focusManager.currentRowIndex];
        if (!currentRow) return;
        
        switch (evt.keyCode) {
            case KeyCodes.LEFT:
                evt.preventDefault();
                if (focusManager.currentItemIndex > 0) {
                    focusManager.currentItemIndex--;
                    updateFocus();
                }
                break;
                
            case KeyCodes.RIGHT:
                evt.preventDefault();
                if (focusManager.currentItemIndex < currentRow.cards.length - 1) {
                    focusManager.currentItemIndex++;
                    updateFocus();
                }
                break;
                
            case KeyCodes.UP:
                evt.preventDefault();
                if (focusManager.currentRowIndex > 0) {
                    focusManager.currentRowIndex--;
                    // Adjust item index if new row has fewer items
                    var newRow = focusManager.rows[focusManager.currentRowIndex];
                    if (focusManager.currentItemIndex >= newRow.cards.length) {
                        focusManager.currentItemIndex = newRow.cards.length - 1;
                    }
                    updateFocus();
                } else {
                    // At top row, go to navbar
                    focusToNavBar();
                }
                break;
                
            case KeyCodes.DOWN:
                evt.preventDefault();
                if (focusManager.currentRowIndex < focusManager.rows.length - 1) {
                    focusManager.currentRowIndex++;
                    // Adjust item index if new row has fewer items
                    var newRow = focusManager.rows[focusManager.currentRowIndex];
                    if (focusManager.currentItemIndex >= newRow.cards.length) {
                        focusManager.currentItemIndex = newRow.cards.length - 1;
                    }
                    updateFocus();
                }
                break;
                
            case KeyCodes.ENTER:
                evt.preventDefault();
                var currentCard = currentRow.cards[focusManager.currentItemIndex];
                if (currentCard) {
                    currentCard.click();
                }
                break;
        }
    }

    /**
     * Show loading indicator
     */
    function showLoading() {
        if (elements.loadingIndicator) {
            elements.loadingIndicator.style.display = 'flex';
        }
        if (elements.rowsContainer) {
            elements.rowsContainer.style.display = 'none';
        }
    }

    /**
     * Hide loading indicator
     */
    function hideLoading() {
        if (elements.loadingIndicator) {
            elements.loadingIndicator.style.display = 'none';
        }
        if (elements.rowsContainer) {
            elements.rowsContainer.style.display = 'block';
        }
    }

    /**
     * Show error message
     */
    function showError(message) {
        if (elements.errorMessage) {
            elements.errorMessage.style.display = 'flex';
        }
        if (elements.errorText) {
            elements.errorText.textContent = message;
        }
        if (elements.rowsContainer) {
            elements.rowsContainer.style.display = 'none';
        }
    }

    // Public API
    return {
        init: init
    };
})();

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', DiscoverController.init);
} else {
    DiscoverController.init();
}
