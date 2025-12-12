var BrowseController = (function() {
    'use strict';

    let auth = null;
    let currentView = 'home';
    let rows = [];
    let userLibraries = [];
    
    const focusManager = {
        currentRow: 0,
        currentItem: 0,
        totalRows: 0,
        inFeaturedBanner: false,
        inNavBar: false,
        navBarIndex: 0,
        rowPositions: {},
        featuredButtonIndex: 0,
        previousRow: 0
    };
    
    const featuredCarousel = {
        items: [],
        currentIndex: 0,
        intervalId: null,
        transitioning: false
    };

    let elements = {};

    const NAVBAR_CHECK_INTERVAL_MS = 50;
    const FOCUS_INIT_DELAY_MS = 100;
    const CONTENT_LOAD_DELAY_MS = 800;
    const CAROUSEL_AUTO_PLAY_INTERVAL_MS = 8000;
    
    // Animation Constants
    const SCROLL_ANIMATION_DURATION_MS = 250;
    const SCROLL_THRESHOLD_PX = 2;
    const ROW_VERTICAL_POSITION = 0.45; // 45% of viewport height

    /**
     * Initialize the browse controller
     * Authenticates, caches elements, loads libraries, and sets up navigation
     */
    function init() {
        JellyfinAPI.Logger.info('Initializing browse controller...');
        
        auth = JellyfinAPI.getStoredAuth();
        if (!auth) {
            JellyfinAPI.Logger.error('No authentication found, redirecting to login');
            window.location.href = 'login.html';
            return;
        }

        JellyfinAPI.Logger.success('Authenticated as:', auth.username);
        
        var checkNavbar = setInterval(function() {
            if (document.getElementById('homeBtn')) {
                clearInterval(checkNavbar);
                cacheElements();
                loadUserLibraries();
                displayUserInfo();
                setupNavigation();
                loadHomeContent();
                
                setTimeout(function() {
                    restoreFocusPosition();
                }, CONTENT_LOAD_DELAY_MS);
            }
        }, NAVBAR_CHECK_INTERVAL_MS);
    }

    /**
     * Cache frequently accessed DOM elements for better performance
     * @private
     */
    function cacheElements() {
        elements = {
            username: document.getElementById('username'),
            userAvatar: document.getElementById('userAvatar'),
            userAvatarImg: document.getElementById('userAvatarImg'),
            userBtn: document.getElementById('userBtn'),
            homeBtn: document.getElementById('homeBtn'),
            moviesBtn: document.getElementById('moviesBtn'),
            showsBtn: document.getElementById('showsBtn'),
            searchBtn: document.getElementById('searchBtn'),
            settingsBtn: document.getElementById('settingsBtn'),
            featuredBanner: document.getElementById('featuredBanner'),
            featuredLogo: document.getElementById('featuredLogo'),
            featuredBackdropContainer: document.getElementById('featuredBackdropContainer'),
            featuredBackdrop: document.getElementById('featuredBackdrop'),
            featuredTitle: document.getElementById('featuredTitle'),
            featuredYear: document.getElementById('featuredYear'),
            featuredRating: document.getElementById('featuredRating'),
            featuredRuntime: document.getElementById('featuredRuntime'),
            featuredGenres: document.getElementById('featuredGenres'),
            featuredOverview: document.getElementById('featuredOverview'),
            carouselPrev: document.getElementById('carouselPrev'),
            carouselNext: document.getElementById('carouselNext'),
            featuredIndicators: document.getElementById('featuredIndicators'),
            detailSection: document.getElementById('detailSection'),
            detailTitle: document.getElementById('detailTitle'),
            detailInfoRow: document.getElementById('detailInfoRow'),
            detailSummary: document.getElementById('detailSummary'),
            contentRows: document.getElementById('contentRows'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            errorDisplay: document.getElementById('errorDisplay'),
            errorText: document.getElementById('errorText'),
            retryBtn: document.getElementById('retryBtn'),
            logoutBtn: document.getElementById('logoutBtn')
        };
    }

    /**
     * Load user's media libraries from Jellyfin server
     * @private
     */
    function loadUserLibraries() {
        JellyfinAPI.getUserViews(auth.serverAddress, auth.userId, auth.accessToken, function(err, response) {
            if (err) {
                JellyfinAPI.Logger.error('Failed to load user libraries:', err);
                return;
            }
            
            if (!response || !response.Items) {
                JellyfinAPI.Logger.error('No library data returned from getUserViews:', {
                    hasResponse: !!response,
                    hasItems: !!(response?.Items)
                });
                return;
            }
            
            // Libraries already filtered in API layer (unsupported types and empty libraries removed)
            userLibraries = response.Items;
            
            JellyfinAPI.Logger.info('Loaded libraries:', userLibraries.length, 'with content');
            
            // Log library details for debugging
            userLibraries.forEach(function(lib) {
                JellyfinAPI.Logger.info('  -', lib.Name, 
                    '(Type:', lib.CollectionType || 'unknown', 
                    'Items:', lib.ChildCount || '?' + ')');
            });
        });
    }

    /**
     * Set up click and keyboard event listeners for navigation
     * @private
     */
    function setupNavigation() {
        if (elements.homeBtn) {
            elements.homeBtn.addEventListener('click', function() {
                switchView('home');
            });
        }
        if (elements.moviesBtn) {
            elements.moviesBtn.addEventListener('click', function() {
                switchView('movies');
            });
        }
        if (elements.showsBtn) {
            elements.showsBtn.addEventListener('click', function() {
                switchView('shows');
            });
        }
        if (elements.retryBtn) {
            elements.retryBtn.addEventListener('click', function() {
                loadHomeContent();
            });
        }
        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', handleLogout);
        }
        
        if (elements.settingsBtn) {
            elements.settingsBtn.addEventListener('click', function() {
                stopCarouselAutoPlay();
                window.location.href = 'settings.html';
            });
        }
        
        if (elements.carouselPrev) {
            elements.carouselPrev.addEventListener('click', function() {
                carouselPrevious();
            });
        }
        if (elements.carouselNext) {
            elements.carouselNext.addEventListener('click', function() {
                carouselNext();
            });
        }
        
        document.addEventListener('keydown', handleKeyDown);
    }
    
    /**
     * Main keyboard event handler for browse view
     * Routes events to appropriate navigation handlers
     * @param {KeyboardEvent} evt - Keyboard event
     * @private
     */
    function handleKeyDown(evt) {
        evt = evt || window.event;
        
        if (evt.keyCode === KeyCodes.BACK) {
            if (focusManager.inFeaturedBanner) {
                focusManager.inFeaturedBanner = false;
                if (elements.featuredBanner) {
                    elements.featuredBanner.classList.remove('focused');
                }
                focusManager.currentRow = 0;
                focusManager.currentItem = 0;
                updateFocus();
                evt.preventDefault();
                return;
            } else if (!focusManager.inNavBar) {
                focusToNavBar();
                evt.preventDefault();
                return;
            }
            webOS.platformBack();
            return;
        }
        
        if (focusManager.inFeaturedBanner) {
            handleFeaturedBannerNavigation(evt);
            return;
        }
        
        if (focusManager.inNavBar) {
            handleNavBarNavigation(evt);
            return;
        }
        
        var allRows = getAllRows();
        if (allRows.length === 0) return;
        
        var currentRowElement = allRows[focusManager.currentRow];
        if (!currentRowElement) return;
        
        var items = currentRowElement.querySelectorAll('.item-card');
        if (items.length === 0) return;
        
        switch (evt.keyCode) {
            case KeyCodes.LEFT:
                evt.preventDefault();
                if (focusManager.currentItem > 0) {
                    focusManager.currentItem--;
                    updateFocus();
                }
                break;
                
            case KeyCodes.RIGHT:
                evt.preventDefault();
                if (focusManager.currentItem < items.length - 1) {
                    focusManager.currentItem++;
                    updateFocus();
                }
                break;
                
            case KeyCodes.UP:
                evt.preventDefault();
                if (focusManager.currentRow > 0) {
                    focusManager.rowPositions[focusManager.currentRow] = focusManager.currentItem;
                    focusManager.previousRow = focusManager.currentRow;
                    focusManager.currentRow--;
                    focusManager.currentItem = focusManager.rowPositions[focusManager.currentRow] || 0;
                    var prevRowItems = allRows[focusManager.currentRow].querySelectorAll('.item-card');
                    if (focusManager.currentItem >= prevRowItems.length) {
                        focusManager.currentItem = prevRowItems.length - 1;
                    }
                    updateRowVisibility();
                    updateFocus();
                } else if (focusManager.currentRow === 0) {
                    // Slide banner back down
                    if (elements.featuredBanner) {
                        elements.featuredBanner.classList.remove('slide-up');
                    }
                    // Don't remove move-up class - it's no longer used
                    
                    // Show all rows when going back to featured banner
                    getAllRows().forEach(function(row) {
                        row.classList.remove('row-hidden');
                    });
                    
                    focusManager.inFeaturedBanner = true;
                    focusManager.inNavBar = false;
                    if (elements.featuredBanner) {
                        elements.featuredBanner.classList.add('focused');
                        elements.featuredBanner.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    updateFeaturedFocus();
                }
                break;
                
            case KeyCodes.DOWN:
                evt.preventDefault();
                if (focusManager.currentRow < allRows.length - 1) {
                    focusManager.rowPositions[focusManager.currentRow] = focusManager.currentItem;
                    focusManager.previousRow = focusManager.currentRow;
                    focusManager.currentRow++;
                    focusManager.currentItem = focusManager.rowPositions[focusManager.currentRow] || 0;
                    var nextRowItems = allRows[focusManager.currentRow].querySelectorAll('.item-card');
                    if (focusManager.currentItem >= nextRowItems.length) {
                        focusManager.currentItem = nextRowItems.length - 1;
                    }
                    updateRowVisibility();
                    updateFocus();
                }
                break;
                
            case KeyCodes.ENTER:
                evt.preventDefault();
                var currentItem = items[focusManager.currentItem];
                if (currentItem) {
                    currentItem.click();
                }
                break;
        }
    }
    
    /**
     * Handle keyboard navigation within featured banner carousel
     * @param {KeyboardEvent} evt - Keyboard event
     * @private
     */
    function handleFeaturedBannerNavigation(evt) {
        switch (evt.keyCode) {
            case KeyCodes.LEFT:
                evt.preventDefault();
                carouselPrevious();
                break;
                
            case KeyCodes.RIGHT:
                evt.preventDefault();
                carouselNext();
                break;
                
            case KeyCodes.UP:
                evt.preventDefault();
                focusToNavBar();
                break;
                
            case KeyCodes.DOWN:
                evt.preventDefault();
                focusManager.inFeaturedBanner = false;
                if (elements.featuredBanner) {
                    elements.featuredBanner.classList.remove('focused');
                    elements.featuredBanner.classList.add('slide-up');
                }
                // Don't add move-up class - let rows stay in their natural position
                focusManager.previousRow = -1;
                focusManager.currentRow = 0;
                focusManager.currentItem = focusManager.rowPositions[0] || 0;
                // Ensure all rows are visible when entering first row from banner
                getAllRows().forEach(function(row) {
                    row.classList.remove('row-hidden');
                });
                updateFocus();
                break;
                
            case KeyCodes.ENTER:
                evt.preventDefault();
                if (featuredCarousel.items && featuredCarousel.items.length > 0) {
                    var currentItem = featuredCarousel.items[featuredCarousel.currentIndex];
                    if (currentItem) {
                        stopCarouselAutoPlay();
                        
                        // Save focus position before navigating
                        saveFocusPosition();
                        
                        window.location.href = 'details.html?id=' + currentItem.Id;
                    }
                }
                break;
        }
    }
    
    /**
     * Handle keyboard navigation within navbar
     * @param {KeyboardEvent} evt - Keyboard event
     * @private
     */
    function handleNavBarNavigation(evt) {
        const navButtons = Array.from(document.querySelectorAll('.nav-left .nav-btn, .nav-center .nav-btn'));
        
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
                focusToFeaturedBanner();
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
    
    function focusToNavBar() {
        focusManager.inNavBar = true;
        focusManager.inFeaturedBanner = false;
        const navButtons = Array.from(document.querySelectorAll('.nav-left .nav-btn, .nav-center .nav-btn'));
        
        // Start at home button (index 1), not user avatar (index 0)
        focusManager.navBarIndex = navButtons.length > 1 ? 1 : 0;
        
        if (navButtons.length > 0) {
            navButtons.forEach(function(btn) {
                btn.classList.remove('focused');
            });
            navButtons[focusManager.navBarIndex].classList.add('focused');
            navButtons[focusManager.navBarIndex].focus();
        }
        
        if (elements.featuredBanner) {
            elements.featuredBanner.classList.remove('focused');
        }
        
        clearAllItemFocus();
    }
    
    function focusToFeaturedBanner() {
        focusManager.inFeaturedBanner = true;
        focusManager.inNavBar = false;
        
        // Slide banner back down if it was up
        if (elements.featuredBanner) {
            elements.featuredBanner.classList.remove('slide-up');
        }
        if (elements.contentRows) {
            elements.contentRows.classList.remove('move-up');
        }
        
        updateFeaturedFocus();
        
        if (elements.featuredBanner) {
            elements.featuredBanner.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        var navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(function(btn) {
            btn.classList.remove('focused');
        });
        
        clearAllItemFocus();
    }
    
    function updateFeaturedFocus() {
        if (elements.featuredBanner) {
            elements.featuredBanner.classList.add('focused');
        }
        // Hide detail section when in featured banner
        if (elements.detailSection) {
            elements.detailSection.style.display = 'none';
        }
        // Remove padding from content rows
        if (elements.contentRows) {
            elements.contentRows.classList.remove('with-detail');
        }
    }
    
    /**
     * Update visibility of rows based on current focus position
     * Hides rows above current row to improve visual focus
     * @private
     */
    function updateRowVisibility() {
        var allRows = getAllRows();
        if (allRows.length === 0) return;
        
        // Keep featured banner hidden when scrolling rows
        if (focusManager.currentRow >= 0 && !focusManager.inFeaturedBanner) {
            if (elements.featuredBanner && !elements.featuredBanner.classList.contains('slide-up')) {
                elements.featuredBanner.classList.add('slide-up');
            }
            if (elements.contentRows && !elements.contentRows.classList.contains('move-up')) {
                elements.contentRows.classList.add('move-up');
            }
        }
        
        allRows.forEach(function(row, index) {
            // Hide rows above current row (keep current and below visible)
            if (index < focusManager.currentRow) {
                row.classList.add('row-hidden');
            } else {
                row.classList.remove('row-hidden');
            }
        });
    }

    /**
     * Update backdrop image for a given element
     * @param {string} elementId - ID of the image element to update
     * @param {Object} itemData - Item data containing backdrop information
     * @private
     */
    function updateBackdropImage(elementId, itemData) {
        var element = document.getElementById(elementId);
        if (!element) return;
        
        if (itemData && itemData.backdropImageTag) {
            var backdropUrl = auth.serverAddress + '/Items/' + itemData.id + 
                '/Images/Backdrop?tag=' + itemData.backdropImageTag + 
                '&maxWidth=1920&quality=90';
            element.src = backdropUrl;
            element.style.display = 'block';
        } else {
            element.style.display = 'none';
        }
    }
    
    function updateDetailSection(itemCard) {
        if (!elements.detailSection || !elements.detailTitle || !elements.detailInfoRow || !elements.detailSummary) {
            return;
        }
        
        var itemData = itemCard.dataset;
        
        // Show detail section and add padding to content rows
        elements.detailSection.style.display = 'block';
        if (elements.contentRows) {
            elements.contentRows.classList.add('with-detail');
        }
        
        // Update backdrop images using helper function
        updateBackdropImage('globalBackdropImage', itemData);
        updateBackdropImage('detailBackdrop', itemData);
        
        // Update title
        elements.detailTitle.textContent = itemData.name || 'Unknown Title';
        
        // Clear and populate info row with badges
        elements.detailInfoRow.innerHTML = '';
        
        if (itemData.year) {
            var yearBadge = document.createElement('span');
            yearBadge.className = 'info-badge';
            yearBadge.textContent = itemData.year;
            elements.detailInfoRow.appendChild(yearBadge);
        }
        
        if (itemData.rating) {
            var ratingBadge = document.createElement('span');
            ratingBadge.className = 'info-badge';
            ratingBadge.textContent = itemData.rating;
            elements.detailInfoRow.appendChild(ratingBadge);
        }
        
        if (itemData.runtime) {
            var runtimeBadge = document.createElement('span');
            runtimeBadge.className = 'info-badge';
            runtimeBadge.textContent = formatRuntime(parseInt(itemData.runtime));
            elements.detailInfoRow.appendChild(runtimeBadge);
        }
        
        if (itemData.genres) {
            var genresBadge = document.createElement('span');
            genresBadge.className = 'info-badge';
            genresBadge.textContent = itemData.genres;
            elements.detailInfoRow.appendChild(genresBadge);
        }
        
        // Update summary
        elements.detailSummary.textContent = itemData.overview || 'No description available.';
    }
    
    function formatRuntime(ticks) {
        var minutes = Math.round(ticks / 600000000);
        var hours = Math.floor(minutes / 60);
        var mins = minutes % 60;
        
        if (hours > 0) {
            return hours + 'h ' + mins + 'm';
        }
        return mins + 'm';
    }
    
    /**
     * Scrolls item horizontally into view within its row using transform
     * @param {HTMLElement} currentItem - The focused item card
     * @param {HTMLElement} rowScroller - The row's scroll container
     */
    function scrollItemHorizontally(currentItem, rowScroller) {
        if (!currentItem || !rowScroller) return;
        
        var rowItems = rowScroller.querySelector('.row-items');
        if (!rowItems) return;
        
        var itemRect = currentItem.getBoundingClientRect();
        var scrollerRect = rowScroller.getBoundingClientRect();
        
        var HORIZONTAL_SCROLL_PADDING = 120; // Increased padding for better positioning
        var EDGE_THRESHOLD = 100; // Distance from edge to trigger scroll
        
        // Calculate item position relative to viewport
        var itemCenter = itemRect.left + (itemRect.width / 2);
        var scrollerCenter = scrollerRect.left + (scrollerRect.width / 2);
        
        // Get current transform
        var currentTransform = getComputedStyle(rowItems).transform;
        var currentX = 0;
        if (currentTransform !== 'none') {
            var matrix = new DOMMatrix(currentTransform);
            currentX = matrix.m41;
        }
        
        // Calculate desired scroll
        var desiredScroll = 0;
        
        if (itemRect.left < scrollerRect.left + EDGE_THRESHOLD) {
            // Item is too far left
            desiredScroll = (scrollerRect.left + HORIZONTAL_SCROLL_PADDING) - itemRect.left;
        } else if (itemRect.right > scrollerRect.right - EDGE_THRESHOLD) {
            // Item is too far right
            desiredScroll = (scrollerRect.right - HORIZONTAL_SCROLL_PADDING) - itemRect.right;
        }
        
        if (Math.abs(desiredScroll) > 5) {
            var newX = currentX + desiredScroll;
            
            // Clamp to prevent scrolling beyond bounds
            var maxScroll = 0;
            var minScroll = -(rowItems.scrollWidth - rowScroller.clientWidth);
            newX = Math.max(minScroll, Math.min(maxScroll, newX));
            
            rowItems.style.transform = 'translateX(' + newX + 'px)';
        }
    }
    
    /**
     * Calculates vertical scroll adjustment to position row on screen
     * @param {HTMLElement} currentRowElement - The current focused row
     * @returns {number} Scroll adjustment in pixels (0 if no adjustment needed)
     */
    function calculateVerticalScrollAdjustment(currentRowElement) {
        if (!currentRowElement) return 0;
        
        const mainContent = document.querySelector('.main-content');
        if (!mainContent) return 0;
        
        // Use row title as the reference point for consistent positioning
        const rowTitle = currentRowElement.querySelector('.row-title');
        const referenceElement = rowTitle || currentRowElement;
        const rowRect = referenceElement.getBoundingClientRect();
        const mainRect = mainContent.getBoundingClientRect();
        
        // Position row title at configured viewport height
        const targetPosition = mainRect.top + (mainRect.height * ROW_VERTICAL_POSITION);
        const scrollAdjustment = rowRect.top - targetPosition;
        
        // No special constraints - all rows positioned consistently
        
        return Math.abs(scrollAdjustment) > SCROLL_THRESHOLD_PX ? scrollAdjustment : 0;
    }
    
    /**
     * Applies vertical scroll adjustment to main content with smooth animation
     * @param {number} scrollAdjustment - Amount to scroll in pixels
     */
    function applyVerticalScroll(scrollAdjustment) {
        if (scrollAdjustment === 0) return;
        
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            const startScroll = mainContent.scrollTop;
            const targetScroll = startScroll + scrollAdjustment;
            let startTime = null;
            
            function animateScroll(currentTime) {
                if (!startTime) startTime = currentTime;
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / SCROLL_ANIMATION_DURATION_MS, 1);
                
                // Spring-like easing for more natural feel
                const easeProgress = progress < 0.5
                    ? 4 * progress * progress * progress
                    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                
                mainContent.scrollTop = startScroll + (scrollAdjustment * easeProgress);
                
                if (progress < 1) {
                    requestAnimationFrame(animateScroll);
                }
            }
            
            requestAnimationFrame(animateScroll);
        }
    }
    
    /**
     * Helper to get all content rows (cached per call)
     * @returns {NodeList} All content row elements
     * @private
     */
    function getAllRows() {
        return document.querySelectorAll('.content-row');
    }
    
    /**
     * Helper to clear focus from all item cards
     * @private
     */
    function clearAllItemFocus() {
        document.querySelectorAll('.item-card').forEach(function(card) {
            card.classList.remove('focused');
        });
    }
    
    /**
     * Update focus to current item and handle scrolling
     * Applies smooth scrolling animation to keep focused item visible
     * @private
     */
    function updateFocus() {
        clearAllItemFocus();
        
        const allRows = getAllRows();
        if (allRows.length === 0) return;
        
        const currentRowElement = allRows[focusManager.currentRow];
        if (!currentRowElement) return;
        
        const items = currentRowElement.querySelectorAll('.item-card');
        if (items.length === 0) return;
        
        const currentItem = items[focusManager.currentItem];
        if (currentItem) {
            currentItem.classList.add('focused');
            currentItem.focus();
            
            const rowScroller = currentRowElement.querySelector('.row-scroller');
            scrollItemHorizontally(currentItem, rowScroller);
            
            updateDetailSection(currentItem);
            
            const scrollAdjustment = calculateVerticalScrollAdjustment(currentRowElement);
            applyVerticalScroll(scrollAdjustment);
        }
    }
    
    function initializeFocus() {
        focusManager.currentRow = 0;
        focusManager.currentItem = 0;
        focusManager.inNavBar = true;
        focusManager.inFeaturedBanner = false;
        
        setTimeout(function() {
            focusToNavBar();
        }, FOCUS_INIT_DELAY_MS);
    }

    function displayUserInfo() {
        if (elements.username) {
            elements.username.textContent = auth.username;
        }
        if (elements.userAvatar && auth.username) {
            elements.userAvatar.textContent = auth.username.charAt(0).toUpperCase();
            elements.userAvatar.style.display = 'flex';
        }
        
        if (elements.userAvatarImg && auth.userId && auth.serverAddress) {
            var avatarUrl = auth.serverAddress + '/Users/' + auth.userId + '/Images/Primary?width=100&quality=90';
            var img = new Image();
            img.onload = function() {
                elements.userAvatarImg.src = avatarUrl;
                elements.userAvatarImg.style.display = 'block';
                if (elements.userAvatar) {
                    elements.userAvatar.style.display = 'none';
                }
            };
            img.onerror = function() {
                if (elements.userAvatar) {
                    elements.userAvatar.style.display = 'flex';
                }
            };
            img.src = avatarUrl;
        }
    }

    /**
     * Switch between different views (home, movies, shows, library)
     * @param {string} view - View name ('home', 'movies', 'shows', 'library')
     * @param {string} [libraryId] - Library ID for library view
     * @param {string} [libraryName] - Library name for library view
     * @param {string} [collectionType] - Collection type (movies, tvshows, etc.)
     * @private
     */
    function switchView(view, libraryId, libraryName, collectionType) {
        currentView = view;
        JellyfinAPI.Logger.info('Switching to view:', view, libraryId || '');
        
        document.querySelectorAll('.nav-btn').forEach(function(btn) {
            btn.classList.remove('active');
        });
        
        if (view === 'home' && elements.homeBtn) {
            elements.homeBtn.classList.add('active');
            // Show featured banner for home view
            if (elements.featuredBanner) {
                elements.featuredBanner.style.display = '';
            }
            loadHomeContent();
        } else if (view === 'movies' && elements.moviesBtn) {
            elements.moviesBtn.classList.add('active');
            loadMoviesContent();
        } else if (view === 'shows' && elements.showsBtn) {
            elements.showsBtn.classList.add('active');
            loadShowsContent();
        } else if (view === 'library' && libraryId) {
            var libraryBtn = document.querySelector('.nav-btn[data-library-id="' + libraryId + '"]');
            if (libraryBtn) {
                libraryBtn.classList.add('active');
            }
            loadLibraryContent(libraryId, libraryName, collectionType);
        }
    }

    /**
     * Load and display home view content
     * Loads featured carousel and content rows
     * @private
     */
    function loadHomeContent() {
        showLoading();
        JellyfinAPI.Logger.info('Loading home content...');
        
        JellyfinAPI.getUserViews(auth.serverAddress, auth.userId, auth.accessToken, function(err, views) {
            if (err) {
                JellyfinAPI.Logger.error('Failed to load libraries:', err);
                showError('Failed to load libraries');
                return;
            }
            
            if (!views || !views.Items) {
                JellyfinAPI.Logger.error('No views data returned from getUserViews:', {
                    hasViews: !!views,
                    hasItems: !!(views?.Items)
                });
                showError('Failed to load libraries');
                return;
            }
            
            if (views.Items.length === 0) {
                JellyfinAPI.Logger.warn('No supported libraries found');
                showError('No media libraries available');
                return;
            }
            
            JellyfinAPI.Logger.success('Loaded user views:', views.Items.length, 'supported libraries');
            
            clearRows();
            loadFeaturedItem();
            
            // Load home rows settings
            var homeRowsSettings = getHomeRowsSettings();
            JellyfinAPI.Logger.info('Home rows settings:', homeRowsSettings);
            
            var rowsToLoad = [];
            
            // Check which library types are available
            var hasTVShows = views.Items.some(function(view) {
                return view.CollectionType && view.CollectionType.toLowerCase() === 'tvshows';
            });
            
            var hasMovies = views.Items.some(function(view) {
                return view.CollectionType && view.CollectionType.toLowerCase() === 'movies';
            });
            
            var hasMusic = views.Items.some(function(view) {
                return view.CollectionType && view.CollectionType.toLowerCase() === 'music';
            });
            
            // Helper function to check if a row type is enabled
            /**
             * Check if a specific home row type is enabled in settings
             * @param {string} rowId - Row identifier (e.g., 'resume', 'nextup')
             * @returns {boolean} True if row is enabled, defaults to true if not found
             * @private
             */
            function isRowEnabled(rowId) {
                var setting = homeRowsSettings.find(function(r) { return r.id === rowId; });
                return setting ? setting.enabled : true;
            }
            
            // Add Continue Watching if enabled
            if (isRowEnabled('resume')) {
                rowsToLoad.push({ 
                    title: 'Continue Watching', 
                    type: 'resume',
                    settingId: 'resume',
                    order: getRowOrder('resume', homeRowsSettings)
                });
            }
            
            // Add Next Up if enabled and TV shows exist
            if (isRowEnabled('nextup') && hasTVShows) {
                rowsToLoad.push({ 
                    title: 'Next Up', 
                    type: 'nextup',
                    settingId: 'nextup',
                    order: getRowOrder('nextup', homeRowsSettings)
                });
            }
            
            // Live TV Support: Check for Live TV availability
            JellyfinAPI.getLiveTVInfo(auth.serverAddress, auth.userId, auth.accessToken,
                function(liveTVErr, liveTVInfo) {
                if (!liveTVErr && liveTVInfo && liveTVInfo.available && isRowEnabled('livetv')) {
                    JellyfinAPI.Logger.success('Live TV detected:', liveTVInfo.channelCount, 'channels');
                    
                    // Add Live TV Channels row
                    rowsToLoad.push({ 
                        title: 'Live TV Channels', 
                        type: 'livetv-channels',
                        viewId: liveTVInfo.viewId,
                        settingId: 'livetv',
                        order: getRowOrder('livetv', homeRowsSettings)
                    });
                    
                    // Add Live TV Recordings row
                    rowsToLoad.push({ 
                        title: 'Recordings', 
                        type: 'livetv-recordings',
                        viewId: liveTVInfo.viewId,
                        settingId: 'livetv',
                        order: getRowOrder('livetv', homeRowsSettings) + 0.5
                    });
                } else {
                    JellyfinAPI.Logger.info('Live TV not available or not enabled');
                }
                
                continueLoadingRows();
            });
            
            function continueLoadingRows() {
                // Add Collections row if enabled
                if (isRowEnabled('collections')) {
                    JellyfinAPI.getCollections(auth.serverAddress, auth.userId, auth.accessToken,
                        function(collErr, collData) {
                        if (!collErr && collData && collData.Items && collData.Items.length > 0) {
                            JellyfinAPI.Logger.success('Collections found:', collData.Items.length);
                            rowsToLoad.push({
                                title: 'Collections',
                                type: 'collections',
                                settingId: 'collections',
                                order: getRowOrder('collections', homeRowsSettings)
                            });
                        } else {
                            JellyfinAPI.Logger.info('No collections available or not enabled');
                        }
                        
                        continueWithLibraries();
                    });
                } else {
                    continueWithLibraries();
                }
            }
            
            function continueWithLibraries() {
                // Libraries already filtered in API layer, just exclude LiveTV here
                // Note: views.Items already validated in parent function
                var librariesForRows = views.Items.filter(function(view) {
                    var collectionType = view.CollectionType ? view.CollectionType.toLowerCase() : '';
                    // Skip LiveTV from regular library list (handled separately above)
                    return collectionType !== 'livetv';
                });
                
                JellyfinAPI.Logger.info('Libraries for home rows:', 
                    librariesForRows.length, 'of', views.Items.length);
                
                // Add Library Tiles row 
                if (librariesForRows.length > 0 && isRowEnabled('library-tiles')) {
                    rowsToLoad.push({
                        title: 'My Media',
                        type: 'library-tiles',
                        libraries: librariesForRows,
                        settingId: 'library-tiles',
                        order: getRowOrder('library-tiles', homeRowsSettings)
                    });
                }
                    
                    // Organize rows by library with proper ordering
                    librariesForRows.forEach(function(view) {
                        var collectionType = view.CollectionType ? view.CollectionType.toLowerCase() : '';
                        
                        if (collectionType === 'movies' && isRowEnabled('latest-movies')) {
                            rowsToLoad.push({ 
                                title: 'Recently added in ' + view.Name, 
                                type: 'latest',
                                parentId: view.Id,
                                itemType: 'Movie',
                                libraryName: view.Name,
                                collectionType: collectionType,
                                settingId: 'latest-movies',
                                order: getRowOrder('latest-movies', homeRowsSettings)
                            });
                        } else if (collectionType === 'tvshows' && isRowEnabled('latest-shows')) {
                            rowsToLoad.push({ 
                                title: 'Recently added in ' + view.Name, 
                                type: 'latest',
                                parentId: view.Id,
                                itemType: 'Episode',
                                libraryName: view.Name,
                                collectionType: collectionType,
                                settingId: 'latest-shows',
                                order: getRowOrder('latest-shows', homeRowsSettings)
                            });
                        } else if (collectionType === 'music' && isRowEnabled('latest-music')) {
                            rowsToLoad.push({
                                title: 'Recently added ' + view.Name,
                                type: 'latest',
                                parentId: view.Id,
                                itemType: 'Audio',
                                libraryName: view.Name,
                                collectionType: collectionType,
                                settingId: 'latest-music',
                                order: getRowOrder('latest-music', homeRowsSettings)
                            });
                        } else {
                            // Generic library type
                            rowsToLoad.push({
                                title: 'Recently added in ' + view.Name,
                                type: 'latest',
                                parentId: view.Id,
                                libraryName: view.Name,
                                collectionType: collectionType,
                                order: 999 // Put generic rows at the end
                            });
                        }
                    });
                
                // Sort rows by order setting
                rowsToLoad.sort(function(a, b) {
                    return a.order - b.order;
                });
                
                // Load each row
                loadRows(rowsToLoad);
            }
        });
    }

    function loadLibraryContent(libraryId, libraryName, collectionType) {
        JellyfinAPI.Logger.info('Loading library content:', libraryName, 'Type:', collectionType);
        showLoading();
        stopCarouselAutoPlay();
        clearRows();
        
        // Hide featured banner for library views
        if (elements.featuredBanner) {
            elements.featuredBanner.style.display = 'none';
        }
        
        var rowsToLoad = [];
        
        // Build rows based on collection type
        if (collectionType === 'movies') {
            // Continue Watching (Resume)
            rowsToLoad.push({
                title: 'Continue Watching',
                type: 'resume',
                parentId: libraryId,
                itemType: 'Movie'
            });
            
            // Latest
            rowsToLoad.push({
                title: 'Latest Movies',
                type: 'latest',
                parentId: libraryId,
                itemType: 'Movie'
            });
            
            // Favorites
            rowsToLoad.push({
                title: 'Favorites',
                type: 'favorites',
                parentId: libraryId,
                itemType: 'Movie'
            });
            
            // Collections (Box Sets)
            rowsToLoad.push({
                title: 'Collections',
                type: 'collections',
                parentId: libraryId
            });
            
        } else if (collectionType === 'tvshows') {
            // Continue Watching (Resume Episodes)
            rowsToLoad.push({
                title: 'Continue Watching',
                type: 'resume',
                parentId: libraryId,
                itemType: 'Episode'
            });
            
            // Next Up
            rowsToLoad.push({
                title: 'Next Up',
                type: 'nextup',
                parentId: libraryId
            });
            
            // Latest Episodes
            rowsToLoad.push({
                title: 'Latest Episodes',
                type: 'latest',
                parentId: libraryId,
                itemType: 'Episode',
                groupItems: true
            });
            
            // Favorites
            rowsToLoad.push({
                title: 'Favorite Shows',
                type: 'favorites',
                parentId: libraryId,
                itemType: 'Series'
            });
            
        } else if (collectionType === 'music') {
            // Latest Albums
            rowsToLoad.push({
                title: 'Latest Albums',
                type: 'latest',
                parentId: libraryId,
                itemType: 'Audio',
                groupItems: true
            });
            
            // Recently Played
            rowsToLoad.push({
                title: 'Recently Played',
                type: 'recentlyplayed',
                parentId: libraryId,
                itemType: 'Audio'
            });
            
            // Favorites
            rowsToLoad.push({
                title: 'Favorite Albums',
                type: 'favorites',
                parentId: libraryId,
                itemType: 'MusicAlbum'
            });
            
            // Playlists
            rowsToLoad.push({
                title: 'Playlists',
                type: 'playlists',
                parentId: libraryId
            });
            
        } else {
            // Generic library view - just show all items
            rowsToLoad.push({
                title: libraryName,
                type: 'all',
                parentId: libraryId
            });
        }
        
        // Load all rows
        loadRows(rowsToLoad);
    }

    function loadMoviesContent() {
        showLoading();
        JellyfinAPI.Logger.info('Loading movies content...');
        
        clearRows();
        elements.featuredBanner.style.opacity = '0';
        elements.featuredBanner.style.pointerEvents = 'none';
        
        var rowsToLoad = [
            { title: 'Latest Movies', type: 'latest', itemType: 'Movie' },
            { title: 'All Movies', type: 'all', itemType: 'Movie' },
            { title: 'Favorites', type: 'favorites', itemType: 'Movie' }
        ];
        
        loadRows(rowsToLoad);
    }

    function loadShowsContent() {
        showLoading();
        JellyfinAPI.Logger.info('Loading TV shows content...');
        
        clearRows();
        elements.featuredBanner.style.opacity = '0';
        elements.featuredBanner.style.pointerEvents = 'none';
        
        var rowsToLoad = [
            { title: 'Latest Episodes', type: 'latest', itemType: 'Episode' },
            { title: 'All TV Shows', type: 'all', itemType: 'Series' },
            { title: 'Favorites', type: 'favorites', itemType: 'Series' }
        ];
        
        loadRows(rowsToLoad);
    }

    function loadRows(rowDefinitions) {
        var completed = 0;
        var hasContent = false;
        
        rowDefinitions.forEach(function(rowDef) {
            loadRow(rowDef, function(success) {
                completed++;
                if (success) hasContent = true;
                
                if (completed === rowDefinitions.length) {
                    hideLoading();
                    if (!hasContent) {
                        showError('No content available in your library');
                    }
                    // Focus initialization handled by restoreFocusPosition in init()
                }
            });
        });
    }

    function loadRow(rowDef, callback) {
        JellyfinAPI.Logger.info('Loading row:', rowDef.title, 'type:', rowDef.type);
        
        // Handle library tiles row (special case - no API call needed)
        if (rowDef.type === 'library-tiles') {
            if (rowDef.libraries && rowDef.libraries.length > 0) {
                JellyfinAPI.Logger.success('Rendering library tiles:', rowDef.libraries.length, 'libraries');
                renderRow(rowDef.title, rowDef.libraries, rowDef.type);
                if (callback) callback(true);
            } else {
                JellyfinAPI.Logger.info('No libraries for tiles row');
                if (callback) callback(false);
            }
            return;
        }
        
        // Use specialized API functions for specific row types
        if (rowDef.type === 'resume') {
            // Continue Watching - use dedicated resume endpoint
            JellyfinAPI.getResumeItems(auth.serverAddress, auth.userId, auth.accessToken, function(err, data) {
                if (err || !data || !data.Items || data.Items.length === 0) {
                    JellyfinAPI.Logger.info('No resume items available');
                    if (callback) callback(false);
                    return;
                }
                
                JellyfinAPI.Logger.success('Loaded row:', rowDef.title, '(' + data.Items.length + ' items)');
                renderRow(rowDef.title, data.Items, rowDef.type);
                if (callback) callback(true);
            });
            return;
        }
        
        if (rowDef.type === 'nextup') {
            // Next Up - use dedicated next up endpoint
            JellyfinAPI.getNextUpItems(auth.serverAddress, auth.userId, auth.accessToken, function(err, data) {
                if (err || !data || !data.Items || data.Items.length === 0) {
                    JellyfinAPI.Logger.info('No next up items available');
                    if (callback) callback(false);
                    return;
                }
                
                JellyfinAPI.Logger.success('Loaded row:', rowDef.title, '(' + data.Items.length + ' items)');
                renderRow(rowDef.title, data.Items, rowDef.type);
                if (callback) callback(true);
            });
            return;
        }
        
        if (rowDef.type === 'latest' && rowDef.parentId) {
            // Latest Media - use dedicated latest endpoint
            var includeTypes = rowDef.itemType || null;
            JellyfinAPI.getLatestMedia(auth.serverAddress, auth.userId, auth.accessToken,
                rowDef.parentId, includeTypes, function(err, data) {
                if (err || !data || !data.Items || data.Items.length === 0) {
                    JellyfinAPI.Logger.info('No latest items for:', rowDef.title);
                    if (callback) callback(false);
                    return;
                }
                
                JellyfinAPI.Logger.success('Loaded row:', rowDef.title, '(' + data.Items.length + ' items)');
                renderRow(rowDef.title, data.Items, rowDef.type);
                if (callback) callback(true);
            });
            return;
        }
        
        // Live TV Support: Handle Live TV channels
        if (rowDef.type === 'livetv-channels') {
            JellyfinAPI.getLiveTVChannels(auth.serverAddress, auth.userId, auth.accessToken, function(err, data) {
                if (err || !data || !data.Items || data.Items.length === 0) {
                    JellyfinAPI.Logger.info('No Live TV channels available');
                    if (callback) callback(false);
                    return;
                }
                
                JellyfinAPI.Logger.success('Loaded row:', rowDef.title, '(' + data.Items.length + ' channels)');
                renderRow(rowDef.title, data.Items, rowDef.type);
                if (callback) callback(true);
            });
            return;
        }
        
        // Live TV Support: Handle Live TV recordings
        if (rowDef.type === 'livetv-recordings') {
            JellyfinAPI.getLiveTVRecordings(auth.serverAddress, auth.userId, auth.accessToken, function(err, data) {
                if (err || !data || !data.Items || data.Items.length === 0) {
                    JellyfinAPI.Logger.info('No Live TV recordings available');
                    if (callback) callback(false);
                    return;
                }
                
                JellyfinAPI.Logger.success('Loaded row:', rowDef.title, '(' + data.Items.length + ' recordings)');
                renderRow(rowDef.title, data.Items, rowDef.type);
                if (callback) callback(true);
            });
            return;
        }
        
        // Collections Support: Handle Collections (Box Sets)
        if (rowDef.type === 'collections') {
            JellyfinAPI.getCollections(auth.serverAddress, auth.userId, auth.accessToken, function(err, data) {
                if (err || !data || !data.Items || data.Items.length === 0) {
                    JellyfinAPI.Logger.info('No collections available');
                    if (callback) callback(false);
                    return;
                }
                
                JellyfinAPI.Logger.success('Loaded row:', rowDef.title, '(' + data.Items.length + ' collections)');
                renderRow(rowDef.title, data.Items, rowDef.type);
                if (callback) callback(true);
            });
            return;
        }
        
        // For other row types, use generic getItems with appropriate params
        var params = {
            userId: auth.userId,
            limit: 20,
            fields: 'PrimaryImageAspectRatio,BasicSyncInfo,ProductionYear,Overview,Genres',
            imageTypeLimit: 1,
            enableImageTypes: 'Primary,Backdrop,Thumb',
            recursive: true
        };
        
        if (rowDef.parentId) {
            params.parentId = rowDef.parentId;
        }
        
        if (rowDef.itemType) {
            params.includeItemTypes = rowDef.itemType;
        }
        
        if (rowDef.groupItems) {
            params.groupItems = true;
        }
        
        var endpoint = '';
        
        if (rowDef.type === 'favorites') {
            // Favorites
            endpoint = '/Users/' + auth.userId + '/Items';
            params.filters = 'IsFavorite';
            params.sortBy = 'SortName';
            params.sortOrder = 'Ascending';
            params.limit = 50;
            
        } else if (rowDef.type === 'collections') {
            // Collections/Box Sets
            endpoint = '/Users/' + auth.userId + '/Items';
            params.includeItemTypes = 'BoxSet';
            params.sortBy = 'SortName';
            params.sortOrder = 'Ascending';
            params.limit = 50;
            delete params.recursive;
            
        } else if (rowDef.type === 'playlists') {
            // Playlists
            endpoint = '/Users/' + auth.userId + '/Items';
            params.includeItemTypes = 'Playlist';
            params.sortBy = 'DateCreated';
            params.sortOrder = 'Descending';
            params.limit = 50;
            
        } else if (rowDef.type === 'recentlyplayed') {
            // Recently Played
            endpoint = '/Users/' + auth.userId + '/Items';
            params.filters = 'IsPlayed';
            params.sortBy = 'DatePlayed';
            params.sortOrder = 'Descending';
            params.limit = 50;
            
        } else {
            // Generic 'all' items view
            endpoint = '/Users/' + auth.userId + '/Items';
            params.sortBy = 'SortName';
            params.sortOrder = 'Ascending';
            params.limit = 100;
        }
        
        JellyfinAPI.getItems(auth.serverAddress, auth.accessToken, endpoint, params, function(err, data) {
            if (err || !data || !data.Items || data.Items.length === 0) {
                JellyfinAPI.Logger.warn('No items for row:', rowDef.title);
                if (callback) callback(false);
                return;
            }
            
            JellyfinAPI.Logger.success('Loaded row:', rowDef.title, '(' + data.Items.length + ' items)');
            renderRow(rowDef.title, data.Items, rowDef.type);
            if (callback) callback(true);
        });
    }

    function loadFeaturedItem() {
        var params = {
            userId: auth.userId,
            limit: 10,
            includeItemTypes: 'Movie,Series',
            filters: 'IsNotFolder',
            sortBy: 'Random',
            fields: 'Overview,ProductionYear,OfficialRating,RunTimeTicks,Genres',
            imageTypeLimit: 1,
            enableImageTypes: 'Backdrop,Primary,Logo',
            recursive: true
        };
        
        JellyfinAPI.getItems(auth.serverAddress, auth.accessToken,
            '/Users/' + auth.userId + '/Items', params, function(err, data) {
            if (!err && data && data.Items && data.Items.length > 0) {
                featuredCarousel.items = data.Items;
                displayFeaturedItem(0);
                createCarouselIndicators();
                startCarouselAutoPlay();
            }
        });
    }
    
    function displayFeaturedItem(index) {
        if (featuredCarousel.transitioning || !featuredCarousel.items.length) return;
        
        featuredCarousel.transitioning = true;
        featuredCarousel.currentIndex = index;
        var item = featuredCarousel.items[index];
        
        if (!item) {
            featuredCarousel.transitioning = false;
            return;
        }
        
        elements.featuredBanner.style.opacity = '1';
        elements.featuredBanner.style.pointerEvents = 'auto';
        
        if (elements.carouselPrev) elements.carouselPrev.style.visibility = 'visible';
        if (elements.carouselNext) elements.carouselNext.style.visibility = 'visible';
        elements.featuredBackdropContainer.style.opacity = '0';
        
        setTimeout(function() {
            elements.featuredTitle.textContent = item.Name;
            if (item.ImageTags && item.ImageTags.Logo) {
                var logoUrl = auth.serverAddress + '/Items/' + item.Id + '/Images/Logo?quality=90&maxWidth=500';
                elements.featuredLogo.src = logoUrl;
                elements.featuredLogo.style.display = 'block';
                elements.featuredTitle.style.display = 'none';
            } else {
                elements.featuredLogo.style.display = 'none';
                elements.featuredTitle.style.display = 'block';
            }
            
            if (item.ProductionYear) {
                elements.featuredYear.textContent = item.ProductionYear;
                elements.featuredYear.style.display = 'inline-block';
            }
            
            if (item.OfficialRating) {
                elements.featuredRating.textContent = item.OfficialRating;
                elements.featuredRating.style.display = 'inline-block';
            }
            
            if (item.RunTimeTicks) {
                var minutes = Math.round(item.RunTimeTicks / 600000000);
                var hours = Math.floor(minutes / 60);
                var mins = minutes % 60;
                elements.featuredRuntime.textContent = hours > 0 ? hours + 'h ' + mins + 'm' : mins + 'm';
                elements.featuredRuntime.style.display = 'inline-block';
            }
            
            if (item.Genres && item.Genres.length > 0) {
                elements.featuredGenres.textContent = item.Genres.slice(0, 3).join(', ');
                elements.featuredGenres.style.display = 'inline-block';
            }
            
            if (item.Overview) {
                elements.featuredOverview.textContent = item.Overview;
            }
            
            if (item.BackdropImageTags && item.BackdropImageTags.length > 0) {
                var backdropUrl = auth.serverAddress + '/Items/' + item.Id +
                    '/Images/Backdrop/0?quality=90&maxWidth=1920';
                elements.featuredBackdrop.src = backdropUrl;
            } else if (item.ImageTags && item.ImageTags.Primary) {
                var primaryUrl = auth.serverAddress + '/Items/' + item.Id + '/Images/Primary?quality=90&maxWidth=1920';
                elements.featuredBackdrop.src = primaryUrl;
            }
            
            updateCarouselIndicators();
            setTimeout(function() {
                elements.featuredBackdropContainer.style.opacity = '1';
                featuredCarousel.transitioning = false;
            }, 50);
        }, 400);
    }
    
    function createCarouselIndicators() {
        if (!elements.featuredIndicators) return;
        
        elements.featuredIndicators.innerHTML = '';
        featuredCarousel.items.forEach(function(item, index) {
            var dot = document.createElement('div');
            dot.className = 'indicator-dot';
            if (index === 0) dot.classList.add('active');
            elements.featuredIndicators.appendChild(dot);
        });
    }
    
    function updateCarouselIndicators() {
        var dots = elements.featuredIndicators.querySelectorAll('.indicator-dot');
        dots.forEach(function(dot, index) {
            if (index === featuredCarousel.currentIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }
    
    function startCarouselAutoPlay() {
        if (featuredCarousel.intervalId) {
            clearInterval(featuredCarousel.intervalId);
        }
        
        featuredCarousel.intervalId = setInterval(function() {
            var nextIndex = (featuredCarousel.currentIndex + 1) % featuredCarousel.items.length;
            displayFeaturedItem(nextIndex);
        }, CAROUSEL_AUTO_PLAY_INTERVAL_MS);
    }
    
    function stopCarouselAutoPlay() {
        if (featuredCarousel.intervalId) {
            clearInterval(featuredCarousel.intervalId);
            featuredCarousel.intervalId = null;
        }
    }
    
    function carouselNext() {
        stopCarouselAutoPlay();
        var nextIndex = (featuredCarousel.currentIndex + 1) % featuredCarousel.items.length;
        displayFeaturedItem(nextIndex);
        startCarouselAutoPlay();
    }
    
    function carouselPrevious() {
        stopCarouselAutoPlay();
        var prevIndex = (featuredCarousel.currentIndex - 1 + featuredCarousel.items.length) %
            featuredCarousel.items.length;
        displayFeaturedItem(prevIndex);
        startCarouselAutoPlay();
    }

    function renderRow(title, items, type) {
        var rowDiv = document.createElement('div');
        rowDiv.className = 'content-row';
        
        if (type === 'resume') {
            rowDiv.classList.add('continue-watching-row');
        } else if (type === 'library-tiles') {
            rowDiv.classList.add('library-tiles-row');
        } else if (type === 'livetv-channels' || type === 'livetv-recordings') {
            rowDiv.classList.add('livetv-row');
        } else if (type === 'collections') {
            rowDiv.classList.add('collections-row');
        }
        
        var titleDiv = document.createElement('h2');
        titleDiv.className = 'row-title';
        titleDiv.textContent = title;
        
        var scrollerDiv = document.createElement('div');
        scrollerDiv.className = 'row-scroller';
        
        var itemsDiv = document.createElement('div');
        itemsDiv.className = 'row-items';
        
        // Handle library tiles differently
        if (type === 'library-tiles') {
            items.forEach(function(library) {
                var tileDiv = createLibraryTile(library);
                itemsDiv.appendChild(tileDiv);
            });
        } else {
            items.forEach(function(item) {
                var itemDiv = createItemCard(item);
                itemsDiv.appendChild(itemDiv);
            });
        }
        
        scrollerDiv.appendChild(itemsDiv);
        rowDiv.appendChild(titleDiv);
        rowDiv.appendChild(scrollerDiv);
        
        elements.contentRows.appendChild(rowDiv);
    }

    /**
     * Create a library tile card (for My Media row)
     * @private
     */
    function createLibraryTile(library) {
        var tile = document.createElement('div');
        tile.className = 'item-card library-tile';
        tile.setAttribute('data-library-id', library.Id);
        
        var img = document.createElement('img');
        img.className = 'item-image';
        
        // Use library primary image or a default icon
        var imageUrl = '';
        if (library.ImageTags && library.ImageTags.Primary) {
            imageUrl = auth.serverAddress + '/Items/' + library.Id + '/Images/Primary?quality=90&maxHeight=400';
        } else {
            // Use a placeholder based on collection type
            var collectionType = library.CollectionType ? library.CollectionType.toLowerCase() : '';
            // For now, use a simple colored placeholder
            var bgColor = collectionType === 'movies' ? '%23e50914' : 
                         collectionType === 'tvshows' ? '%23564d80' :
                         collectionType === 'music' ? '%231db954' : '%23333';
            imageUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" ' +
                'width="200" height="200"%3E%3Crect fill="' + bgColor + '" width="200" ' +
                'height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" ' +
                'fill="white" font-size="24"%3E' + encodeURIComponent(library.Name.charAt(0)) +
                '%3C/text%3E%3C/svg%3E';
        }
        
        img.src = imageUrl;
        img.alt = library.Name;
        
        var titleDiv = document.createElement('div');
        titleDiv.className = 'item-title';
        titleDiv.textContent = library.Name;
        
        var countDiv = document.createElement('div');
        countDiv.className = 'library-count';
        if (library.ChildCount !== undefined) {
            countDiv.textContent = library.ChildCount + ' items';
        }
        
        tile.appendChild(img);
        tile.appendChild(titleDiv);
        tile.appendChild(countDiv);
        
        tile.addEventListener('click', function() {
            handleLibraryTileClick(library);
        });
        
        tile.libraryData = library;
        
        return tile;
    }

    /**
     * Handle library tile clicks
     * @private
     */
    function handleLibraryTileClick(library) {
        JellyfinAPI.Logger.info('Library tile clicked:', library.Name, library.Id);
        loadLibraryContent(library.Id, library.Name, library.CollectionType);
    }

    function createItemCard(item) {
        var card = document.createElement('div');
        card.className = 'item-card';
        card.setAttribute('data-item-id', item.Id);
        
        // Live TV Support: Check if this is a Live TV channel or recording
        var isLiveTVChannel = item.Type === 'TvChannel';
        var isLiveTVRecording = item.Type === 'Recording';
        
        // Collections Support: Check if this is a box set
        var isBoxSet = item.Type === 'BoxSet';
        
        // TV Shows Support: Check if this is a series
        var isSeries = item.Type === 'Series';
        
        if (isLiveTVChannel) {
            card.classList.add('livetv-channel');
        } else if (isLiveTVRecording) {
            card.classList.add('livetv-recording');
        } else if (isBoxSet) {
            card.classList.add('collection-item');
        }
        
        // Add data attributes for detail section
        card.dataset.name = item.Name || '';
        card.dataset.year = item.ProductionYear || '';
        card.dataset.rating = item.OfficialRating || '';
        card.dataset.runtime = item.RunTimeTicks || '';
        card.dataset.overview = item.Overview || '';
        card.dataset.id = item.Id || '';
        
        // Store backdrop image tag if available
        if (item.BackdropImageTags && item.BackdropImageTags.length > 0) {
            card.dataset.backdropImageTag = item.BackdropImageTags[0];
        } else if (item.ParentBackdropImageTags && item.ParentBackdropImageTags.length > 0) {
            card.dataset.backdropImageTag = item.ParentBackdropImageTags[0];
            card.dataset.id = item.ParentBackdropItemId || item.SeriesId || item.Id;
        }
        
        if (item.Genres && item.Genres.length > 0) {
            card.dataset.genres = item.Genres.slice(0, 3).join(', ');
        } else {
            card.dataset.genres = '';
        }
        
        // Store child count for collections and series
        if ((isBoxSet || isSeries) && item.ChildCount) {
            card.dataset.childCount = item.ChildCount;
        }
        
        var img = document.createElement('img');
        img.className = 'item-image';
        
        var imageUrl = '';
        
        // Live TV Support: Handle channel images
        if (isLiveTVChannel) {
            // Use channel logo/primary image
            if (item.ImageTags && item.ImageTags.Primary) {
                imageUrl = auth.serverAddress + '/Items/' + item.Id + '/Images/Primary?quality=90&maxWidth=400';
            }
        } else if (item.ImageTags && item.ImageTags.Primary) {
            imageUrl = auth.serverAddress + '/Items/' + item.Id + '/Images/Primary?quality=90&maxHeight=400';
        } else if (item.SeriesId && item.SeriesPrimaryImageTag) {
            imageUrl = auth.serverAddress + '/Items/' + item.SeriesId +
                '/Images/Primary?quality=90&maxHeight=400&tag=' + item.SeriesPrimaryImageTag;
        }
        
        if (imageUrl) {
            img.src = imageUrl;
        } else {
            // Live TV channels get special placeholder
            var placeholderColor = isLiveTVChannel ? '%23e74c3c' : '%23333';
            img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" ' +
                'width="200" height="300"%3E%3Crect fill="' + placeholderColor +
                '" width="200" height="300"/%3E%3C/svg%3E';
        }
        
        img.alt = item.Name;
        
        var titleDiv = document.createElement('div');
        titleDiv.className = 'item-title';
        titleDiv.textContent = item.Name;
        
        // Live TV Support: Add channel number for channels
        if (isLiveTVChannel && item.ChannelNumber) {
            var channelInfo = document.createElement('div');
            channelInfo.className = 'channel-info';
            channelInfo.textContent = 'Ch ' + item.ChannelNumber;
            card.appendChild(img);
            card.appendChild(channelInfo);
            card.appendChild(titleDiv);
        } else if (isBoxSet || isSeries) {
            // Collections & TV Shows: Add count badge in top right corner
            // Series: Use RecursiveItemCount (episode count)
            // BoxSet: Use ChildCount (item count)
            var itemCount = isSeries ? item.RecursiveItemCount : item.ChildCount;
            
            if (itemCount) {
                var countBadge = document.createElement('div');
                countBadge.className = 'count-badge';
                var displayCount = itemCount > 99 ? '99+' : itemCount.toString();
                countBadge.textContent = displayCount;
                
                card.appendChild(img);
                card.appendChild(countBadge);
                card.appendChild(titleDiv);
            } else {
                // No count available
                card.appendChild(img);
                card.appendChild(titleDiv);
            }
        } else {
            card.appendChild(img);
            card.appendChild(titleDiv);
        }
        
        card.addEventListener('click', function() {
            handleItemClick(item);
        });
        
        card.itemData = item;
        
        return card;
    }

    function handleItemClick(item) {
        JellyfinAPI.Logger.info('Item clicked:', item.Name, item.Id, 'Type:', item.Type);
        
        // Live TV Support: Handle Live TV channel playback
        if (item.Type === 'TvChannel') {
            JellyfinAPI.Logger.info('Starting Live TV channel:', item.Name);
            window.location.href = 'player.html?id=' + item.Id + '&mediaType=livetv';
            return;
        }
        
        // Live TV Support: Handle recording playback
        if (item.Type === 'Recording') {
            JellyfinAPI.Logger.info('Playing Live TV recording:', item.Name);
            window.location.href = 'player.html?id=' + item.Id + '&mediaType=recording';
            return;
        }
        
        // Save current focus position before navigating away
        saveFocusPosition();
        
        window.location.href = 'details.html?id=' + item.Id;
    }

    function saveFocusPosition() {
        var position = {
            inFeaturedBanner: focusManager.inFeaturedBanner,
            inNavBar: focusManager.inNavBar,
            currentRow: focusManager.currentRow,
            currentItem: focusManager.currentItem,
            featuredButtonIndex: focusManager.featuredButtonIndex,
            timestamp: Date.now()
        };
        
        try {
            localStorage.setItem('browsePosition', JSON.stringify(position));
            JellyfinAPI.Logger.info('Saved browse position:', position);
        } catch (e) {
            JellyfinAPI.Logger.error('Failed to save browse position:', e);
        }
    }

    function restoreFocusPosition() {
        try {
            var savedPosition = localStorage.getItem('browsePosition');
            if (!savedPosition) {
                // No saved position, default to featured banner if enabled
                defaultFocus();
                return;
            }
            
            var position = JSON.parse(savedPosition);
            
            // Check if position is recent (within 5 minutes)
            var age = Date.now() - position.timestamp;
            if (age > 5 * 60 * 1000) {
                JellyfinAPI.Logger.info('Saved position too old, using default');
                localStorage.removeItem('browsePosition');
                defaultFocus();
                return;
            }
            
            // If was in navbar, don't restore - use default focus
            if (position.inNavBar) {
                JellyfinAPI.Logger.info('Was in navbar, using default focus');
                localStorage.removeItem('browsePosition');
                defaultFocus();
                return;
            }
            
            // If was in featured banner, restore featured banner focus
            if (position.inFeaturedBanner && elements.featuredBanner &&
                elements.featuredBanner.style.display !== 'none') {
                JellyfinAPI.Logger.info('Restoring featured banner focus');
                focusManager.inFeaturedBanner = true;
                focusManager.inNavBar = false;
                focusManager.featuredButtonIndex = position.featuredButtonIndex || 0;
                var featuredButtons = [elements.carouselPrev, elements.carouselNext];
                if (featuredButtons[focusManager.featuredButtonIndex]) {
                    featuredButtons[focusManager.featuredButtonIndex].focus();
                }
                localStorage.removeItem('browsePosition');
                return;
            }
            
            // Restore row and item position
            if (typeof position.currentRow === 'number' && typeof position.currentItem === 'number') {
                var rowElements = elements.contentRows.querySelectorAll('.content-row');
                if (position.currentRow < rowElements.length) {
                    JellyfinAPI.Logger.info('Restoring row focus:', position.currentRow, position.currentItem);
                    focusManager.currentRow = position.currentRow;
                    focusManager.currentItem = position.currentItem;
                    focusManager.inFeaturedBanner = false;
                    focusManager.inNavBar = false;
                    
                    // Update focus
                    updateFocus();
                    localStorage.removeItem('browsePosition');
                    return;
                }
            }
            
            // Fallback to default
            defaultFocus();
            
        } catch (e) {
            JellyfinAPI.Logger.error('Failed to restore browse position:', e);
            defaultFocus();
        }
    }

    function defaultFocus() {
        // Check if featured banner is enabled and visible
        if (elements.featuredBanner && elements.featuredBanner.style.display !== 'none' &&
            featuredCarousel.items && featuredCarousel.items.length > 0) {
            JellyfinAPI.Logger.info('Default focus: featured banner');
            focusManager.inFeaturedBanner = true;
            focusManager.inNavBar = false;
            focusManager.featuredButtonIndex = 0;
            if (elements.carouselPrev) {
                elements.carouselPrev.focus();
            }
        } else {
            // Default to first item in first row
            JellyfinAPI.Logger.info('Default focus: first row');
            focusManager.currentRow = 0;
            focusManager.currentItem = 0;
            focusManager.inFeaturedBanner = false;
            focusManager.inNavBar = false;
            updateFocus();
        }
    }

    function clearRows() {
        elements.contentRows.innerHTML = '';
    }

    function showLoading() {
        elements.loadingIndicator.style.display = 'flex';
        elements.errorDisplay.style.display = 'none';
        elements.contentRows.style.display = 'none';
    }

    function hideLoading() {
        elements.loadingIndicator.style.display = 'none';
        elements.contentRows.style.display = 'block';
    }

    function showError(message) {
        hideLoading();
        elements.errorText.textContent = message;
        elements.errorDisplay.style.display = 'flex';
        elements.contentRows.style.display = 'none';
        JellyfinAPI.Logger.error(message);
    }

    function handleLogout() {
        stopCarouselAutoPlay();
        JellyfinAPI.logout();
        window.location.href = 'login.html';
    }

    function reloadCurrentView() {
        if (!auth) {
            auth = JellyfinAPI.getStoredAuth();
            if (!auth) return;
        }
        
        JellyfinAPI.Logger.info('Reloading current view:', currentView);
        
        if (currentView === 'home') {
            loadHomeContent();
        } else if (currentView === 'movies' || currentView === 'shows') {
            var libraryType = currentView === 'movies' ? 'movies' : 'tvshows';
            var library = userLibraries.find(function(lib) {
                return lib.CollectionType === libraryType;
            });
            if (library) {
                loadLibraryContent(library.Id, library.Name, library.CollectionType);
            }
        }
    }

    /**
     * Get home rows settings from storage or return defaults
     * Retrieves user-configured home row preferences including enabled state and display order
     * @returns {Array<Object>} Array of home row configuration objects with id, name, enabled, and order properties
     * @private
     */
    function getHomeRowsSettings() {
        var stored = storage.get('jellyfin_settings');
        if (stored) {
            try {
                var parsedSettings = JSON.parse(stored);
                if (parsedSettings.homeRows) {
                    return parsedSettings.homeRows;
                }
            } catch (e) {
                JellyfinAPI.Logger.error('Failed to parse settings:', e);
            }
        }
        
        // Return default settings
        return [
            { id: 'resume', name: 'Continue Watching', enabled: true, order: 0 },
            { id: 'nextup', name: 'Next Up', enabled: true, order: 1 },
            { id: 'livetv', name: 'Live TV', enabled: true, order: 2 },
            { id: 'library-tiles', name: 'My Media', enabled: true, order: 3 },
            { id: 'collections', name: 'Collections', enabled: true, order: 4 },
            { id: 'latest-movies', name: 'Latest Movies', enabled: true, order: 5 },
            { id: 'latest-shows', name: 'Latest TV Shows', enabled: true, order: 6 },
            { id: 'latest-music', name: 'Latest Music', enabled: true, order: 7 }
        ];
    }

    /**
     * Get the order value for a specific row type
     * Used to determine display position of home rows based on user preferences
     * @param {string} rowId - Row identifier (e.g., 'resume', 'nextup', 'library-tiles')
     * @param {Array<Object>} settings - Home rows settings array from getHomeRowsSettings()
     * @returns {number} Order value for sorting, defaults to 999 if row not found
     * @private
     */
    function getRowOrder(rowId, settings) {
        var setting = settings.find(function(r) { return r.id === rowId; });
        return setting ? setting.order : 999;
    }

    return {
        init: init,
        reloadCurrentView: reloadCurrentView
    };
})();

window.addEventListener('load', function() {
    BrowseController.init();
});

window.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        JellyfinAPI.Logger.info('Page became visible, reloading content...');
        BrowseController.reloadCurrentView();
    }
});
