var BrowseController = (function() {
    'use strict';

    var auth = null;
    var currentView = 'home';
    var rows = [];
    var userLibraries = [];
    
    var focusManager = {
        currentRow: 0,
        currentItem: 0,
        totalRows: 0,
        inFeaturedBanner: false,
        inNavBar: false,
        navBarIndex: 0,
        rowPositions: {},
        featuredButtonIndex: 0
    };
    
    var featuredCarousel = {
        items: [],
        currentIndex: 0,
        intervalId: null,
        transitioning: false
    };

    var elements = {};

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
            }
        }, 50);
    }

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
            contentRows: document.getElementById('contentRows'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            errorDisplay: document.getElementById('errorDisplay'),
            errorText: document.getElementById('errorText'),
            retryBtn: document.getElementById('retryBtn'),
            logoutBtn: document.getElementById('logoutBtn')
        };
    }

    function loadUserLibraries() {
        JellyfinAPI.getUserViews(auth.serverAddress, auth.userId, auth.accessToken, function(err, response) {
            if (err) {
                JellyfinAPI.Logger.error('Failed to load user libraries:', err);
                return;
            }
            
            if (response && response.Items) {
                userLibraries = response.Items;
                JellyfinAPI.Logger.info('Loaded libraries:', userLibraries.length);
                
                var navPill = document.querySelector('.nav-pill');
                if (navPill) {
                    userLibraries.forEach(function(library) {
                        var btn = document.createElement('button');
                        btn.className = 'nav-btn';
                        btn.dataset.libraryId = library.Id;
                        btn.dataset.libraryName = library.Name;
                        btn.dataset.collectionType = library.CollectionType || 'mixed';
                        
                        var label = document.createElement('span');
                        label.className = 'nav-label';
                        label.textContent = library.Name;
                        btn.appendChild(label);
                        
                        btn.addEventListener('click', function() {
                            switchView('library', library.Id, library.Name, library.CollectionType);
                        });
                        
                        navPill.appendChild(btn);
                    });
                }
            }
        });
    }

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
        if (elements.settingsBtn) {
            elements.settingsBtn.addEventListener('click', handleLogout);
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
        
        var allRows = document.querySelectorAll('.content-row');
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
                    focusManager.currentRow--;
                    focusManager.currentItem = focusManager.rowPositions[focusManager.currentRow] || 0;
                    var prevRowItems = allRows[focusManager.currentRow].querySelectorAll('.item-card');
                    if (focusManager.currentItem >= prevRowItems.length) {
                        focusManager.currentItem = prevRowItems.length - 1;
                    }
                    updateFocus();
                } else if (focusManager.currentRow === 0) {
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
                    focusManager.currentRow++;
                    focusManager.currentItem = focusManager.rowPositions[focusManager.currentRow] || 0;
                    var nextRowItems = allRows[focusManager.currentRow].querySelectorAll('.item-card');
                    if (focusManager.currentItem >= nextRowItems.length) {
                        focusManager.currentItem = nextRowItems.length - 1;
                    }
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
                }
                focusManager.currentRow = 0;
                focusManager.currentItem = focusManager.rowPositions[0] || 0;
                updateFocus();
                break;
                
            case KeyCodes.ENTER:
                evt.preventDefault();
                if (featuredCarousel.items && featuredCarousel.items.length > 0) {
                    var currentItem = featuredCarousel.items[featuredCarousel.currentIndex];
                    if (currentItem) {
                        stopCarouselAutoPlay();
                        window.location.href = 'details.html?id=' + currentItem.Id;
                    }
                }
                break;
        }
    }
    
    function handleNavBarNavigation(evt) {
        var navButtons = Array.from(document.querySelectorAll('.nav-center .nav-btn, .nav-right .nav-btn'));
        
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
                var currentBtn = navButtons[focusManager.navBarIndex];
                if (currentBtn) {
                    currentBtn.click();
                }
                break;
        }
    }
    
    function focusToNavBar() {
        focusManager.inNavBar = true;
        focusManager.inFeaturedBanner = false;
        focusManager.navBarIndex = 0;
        var navButtons = Array.from(document.querySelectorAll('.nav-center .nav-btn, .nav-right .nav-btn'));
        if (navButtons.length > 0) {
            navButtons.forEach(function(btn) {
                btn.classList.remove('focused');
            });
            navButtons[0].classList.add('focused');
            navButtons[0].focus();
        }
        
        if (elements.featuredBanner) {
            elements.featuredBanner.classList.remove('focused');
        }
        
        var items = document.querySelectorAll('.item-card');
        items.forEach(function(item) {
            item.classList.remove('focused');
        });
    }
    
    function focusToFeaturedBanner() {
        focusManager.inFeaturedBanner = true;
        focusManager.inNavBar = false;
        
        updateFeaturedFocus();
        
        if (elements.featuredBanner) {
            elements.featuredBanner.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        var navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(function(btn) {
            btn.classList.remove('focused');
        });
        
        var items = document.querySelectorAll('.item-card');
        items.forEach(function(item) {
            item.classList.remove('focused');
        });
    }
    
    function updateFeaturedFocus() {
        if (elements.featuredBanner) {
            elements.featuredBanner.classList.add('focused');
        }
    }
    
    function updateFocus() {
        document.querySelectorAll('.item-card').forEach(function(card) {
            card.classList.remove('focused');
        });
        
        var allRows = document.querySelectorAll('.content-row');
        if (allRows.length === 0) return;
        
        var currentRowElement = allRows[focusManager.currentRow];
        if (!currentRowElement) return;
        
        var items = currentRowElement.querySelectorAll('.item-card');
        if (items.length === 0) return;
        
        var currentItem = items[focusManager.currentItem];
        if (currentItem) {
            currentItem.classList.add('focused');
            currentItem.focus();
            
            var rowScroller = currentRowElement.querySelector('.row-scroller');
            if (rowScroller) {
                var itemRect = currentItem.getBoundingClientRect();
                var scrollerRect = rowScroller.getBoundingClientRect();
                
                if (itemRect.left < scrollerRect.left) {
                    rowScroller.scrollLeft -= (scrollerRect.left - itemRect.left) + 60;
                } else if (itemRect.right > scrollerRect.right) {
                    rowScroller.scrollLeft += (itemRect.right - scrollerRect.right) + 60;
                }
            }
            
            currentRowElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    function initializeFocus() {
        focusManager.currentRow = 0;
        focusManager.currentItem = 0;
        focusManager.inNavBar = true;
        focusManager.inFeaturedBanner = false;
        
        setTimeout(function() {
            focusToNavBar();
        }, 100);
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

    function switchView(view, libraryId, libraryName, collectionType) {
        currentView = view;
        JellyfinAPI.Logger.info('Switching to view:', view, libraryId || '');
        
        document.querySelectorAll('.nav-btn').forEach(function(btn) {
            btn.classList.remove('active');
        });
        
        if (view === 'home' && elements.homeBtn) {
            elements.homeBtn.classList.add('active');
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

    function loadHomeContent() {
        showLoading();
        JellyfinAPI.Logger.info('Loading home content...');
        
        JellyfinAPI.getUserViews(auth.serverAddress, auth.userId, auth.accessToken, function(err, views) {
            if (err) {
                showError('Failed to load libraries');
                return;
            }
            
            JellyfinAPI.Logger.success('Loaded user views:', views);
            
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
        JellyfinAPI.Logger.info('Loading library content:', libraryName);
        showLoading();
        stopCarouselAutoPlay();
        clearRows();
        var requestUrl = auth.serverAddress + '/Users/' + auth.userId + '/Items?ParentId=' + libraryId + 
                        '&Limit=50&Fields=PrimaryImageAspectRatio,Overview,Genres,CommunityRating,OfficialRating&ImageTypeLimit=1&SortBy=SortName&SortOrder=Ascending';
        
        ajax.request(requestUrl, {
            method: 'GET',
            headers: {
                'X-Emby-Authorization': JellyfinAPI.getAuthHeader(auth.accessToken)
            },
            success: function(response) {
                if (response && response.Items && response.Items.length > 0) {
                    var rowsToLoad = [{
                        title: libraryName,
                        items: response.Items
                    }];
                    loadContent(rowsToLoad);
                } else {
                    hideLoading();
                    showError('No items found in ' + libraryName);
                }
            },
            error: function(err) {
                JellyfinAPI.Logger.error('Failed to load library content:', err);
                showError('Failed to load ' + libraryName);
            }
        });
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
                    } else {
                        initializeFocus();
                    }
                }
            });
        });
    }

    function loadRow(rowDef, callback) {
        var params = {
            userId: auth.userId,
            limit: 20,
            fields: 'PrimaryImageAspectRatio,BasicSyncInfo,ProductionYear,Overview',
            imageTypeLimit: 1,
            enableImageTypes: 'Primary,Backdrop,Thumb'
        };
        
        if (rowDef.parentId) {
            params.parentId = rowDef.parentId;
        }
        
        if (rowDef.itemType) {
            params.includeItemTypes = rowDef.itemType;
        }
        
        var endpoint = '';
        if (rowDef.type === 'resume') {
            endpoint = '/Users/' + auth.userId + '/Items/Resume';
        } else if (rowDef.type === 'latest') {
            endpoint = '/Users/' + auth.userId + '/Items/Latest';
            params.limit = 16;
        } else if (rowDef.type === 'favorites') {
            endpoint = '/Users/' + auth.userId + '/Items';
            params.filters = 'IsFavorite';
        } else {
            endpoint = '/Users/' + auth.userId + '/Items';
            params.sortBy = 'DateCreated,SortName';
            params.sortOrder = 'Descending';
        }
        
        JellyfinAPI.getItems(auth.serverAddress, auth.accessToken, endpoint, params, function(err, data) {
            if (err || !data || !data.Items || data.Items.length === 0) {
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
            excludeItemTypes: 'BoxSet,CollectionFolder',
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
        }, 8000);
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
        window.location.href = 'details.html?id=' + item.Id;
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
