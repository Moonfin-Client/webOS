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
                JellyfinAPI.Logger.error('No library data returned');
                return;
            }
            
            userLibraries = response.Items;
            JellyfinAPI.Logger.info('Loaded libraries:', userLibraries.length);
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
                JellyfinAPI.Logger.error('No views data returned');
                showError('Failed to load libraries');
                return;
            }
            
            JellyfinAPI.Logger.success('Loaded user views:', views.Items.length, 'views');
            
            clearRows();
            loadFeaturedItem();
            
            var rowsToLoad = [];
            rowsToLoad.push({ title: 'Continue Watching', type: 'resume' });
            if (views && views.Items) {
                views.Items.forEach(function(view) {
                    if (view.CollectionType === 'movies') {
                        rowsToLoad.push({ 
                            title: 'Latest Movies', 
                            type: 'latest',
                            parentId: view.Id,
                            itemType: 'Movie'
                        });
                        rowsToLoad.push({ 
                            title: 'Movies', 
                            type: 'all',
                            parentId: view.Id,
                            itemType: 'Movie'
                        });
                    } else if (view.CollectionType === 'tvshows') {
                        rowsToLoad.push({ 
                            title: 'Latest Episodes', 
                            type: 'latest',
                            parentId: view.Id,
                            itemType: 'Episode'
                        });
                        rowsToLoad.push({ 
                            title: 'TV Shows', 
                            type: 'all',
                            parentId: view.Id,
                            itemType: 'Series'
                        });
                    }
                });
            }
            
            // Load each row
            loadRows(rowsToLoad);
        });
    }

    function loadLibraryContent(libraryId, libraryName, collectionType) {
        JellyfinAPI.Logger.info('Loading library content:', libraryName, 'Type:', collectionType);
        showLoading();
        stopCarouselAutoPlay();
        clearRows();
        
        // Hide featured banner for library views (Android TV doesn't show featured banner in library views)
        if (elements.featuredBanner) {
            elements.featuredBanner.style.display = 'none';
        }
        
        var rowsToLoad = [];
        
        // Build rows based on collection type (matching Android TV structure)
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
        
        // Match Android TV row types
        if (rowDef.type === 'resume') {
            // Continue Watching
            endpoint = '/Users/' + auth.userId + '/Items/Resume';
            params.filters = 'IsResumable';
            params.sortBy = 'DatePlayed';
            params.sortOrder = 'Descending';
            params.limit = 12;
            
        } else if (rowDef.type === 'nextup') {
            // Next Up (TV Shows)
            endpoint = '/Shows/NextUp';
            params.limit = 12;
            
        } else if (rowDef.type === 'latest') {
            // Latest Items
            endpoint = '/Users/' + auth.userId + '/Items/Latest';
            params.limit = 16;
            if (rowDef.groupItems) {
                params.groupItems = true;
            }
            
        } else if (rowDef.type === 'favorites') {
            // Favorites
            endpoint = '/Users/' + auth.userId + '/Items';
            params.filters = 'IsFavorite';
            params.sortBy = 'SortName';
            params.sortOrder = 'Ascending';
            params.limit = 50;
            
        } else if (rowDef.type === 'collections') {
            // Collections/Box Sets (exclude from regular browsing per Android TV)
            endpoint = '/Users/' + auth.userId + '/Items';
            params.includeItemTypes = 'BoxSet';
            params.sortBy = 'SortName';
            params.sortOrder = 'Ascending';
            params.limit = 50;
            delete params.recursive; // Box sets are at parent level
            
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
            renderRow(rowDef.title, data.Items);
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
        
        JellyfinAPI.getItems(auth.serverAddress, auth.accessToken, '/Users/' + auth.userId + '/Items', params, function(err, data) {
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
                var backdropUrl = auth.serverAddress + '/Items/' + item.Id + '/Images/Backdrop/0?quality=90&maxWidth=1920';
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
        var prevIndex = (featuredCarousel.currentIndex - 1 + featuredCarousel.items.length) % featuredCarousel.items.length;
        displayFeaturedItem(prevIndex);
        startCarouselAutoPlay();
    }

    function renderRow(title, items) {
        var rowDiv = document.createElement('div');
        rowDiv.className = 'content-row';
        
        var titleDiv = document.createElement('h2');
        titleDiv.className = 'row-title';
        titleDiv.textContent = title;
        
        var scrollerDiv = document.createElement('div');
        scrollerDiv.className = 'row-scroller';
        
        var itemsDiv = document.createElement('div');
        itemsDiv.className = 'row-items';
        
        items.forEach(function(item) {
            var itemDiv = createItemCard(item);
            itemsDiv.appendChild(itemDiv);
        });
        
        scrollerDiv.appendChild(itemsDiv);
        rowDiv.appendChild(titleDiv);
        rowDiv.appendChild(scrollerDiv);
        
        elements.contentRows.appendChild(rowDiv);
    }

    function createItemCard(item) {
        var card = document.createElement('div');
        card.className = 'item-card';
        card.setAttribute('data-item-id', item.Id);
        
        // Add data attributes for detail section
        card.dataset.name = item.Name || '';
        card.dataset.year = item.ProductionYear || '';
        card.dataset.rating = item.OfficialRating || '';
        card.dataset.runtime = item.RunTimeTicks || '';
        card.dataset.overview = item.Overview || '';
        
        if (item.Genres && item.Genres.length > 0) {
            card.dataset.genres = item.Genres.slice(0, 3).join(', ');
        } else {
            card.dataset.genres = '';
        }
        
        var img = document.createElement('img');
        img.className = 'item-image';
        
        var imageUrl = '';
        if (item.ImageTags && item.ImageTags.Primary) {
            imageUrl = auth.serverAddress + '/Items/' + item.Id + '/Images/Primary?quality=90&maxHeight=400';
        } else if (item.SeriesId && item.SeriesPrimaryImageTag) {
            imageUrl = auth.serverAddress + '/Items/' + item.SeriesId + '/Images/Primary?quality=90&maxHeight=400&tag=' + item.SeriesPrimaryImageTag;
        }
        
        if (imageUrl) {
            img.src = imageUrl;
        } else {
            img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect fill="%23333" width="200" height="300"/%3E%3C/svg%3E';
        }
        
        img.alt = item.Name;
        
        var titleDiv = document.createElement('div');
        titleDiv.className = 'item-title';
        titleDiv.textContent = item.Name;
        
        card.appendChild(img);
        card.appendChild(titleDiv);
        
        card.addEventListener('click', function() {
            handleItemClick(item);
        });
        
        card.itemData = item;
        
        return card;
    }

    function handleItemClick(item) {
        JellyfinAPI.Logger.info('Item clicked:', item.Name, item.Id);
        
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
            if (position.inFeaturedBanner && elements.featuredBanner && elements.featuredBanner.style.display !== 'none') {
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
        if (elements.featuredBanner && elements.featuredBanner.style.display !== 'none' && featuredCarousel.items && featuredCarousel.items.length > 0) {
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

    return {
        init: init
    };
})();

window.addEventListener('load', function() {
    BrowseController.init();
});
