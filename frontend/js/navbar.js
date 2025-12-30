/**
 * Navbar Module
 * Manages navigation bar loading, user libraries, clock, and toolbar settings
 * @module Navbar
 */
(function() {
    'use strict';
    
    var CLOCK_UPDATE_INTERVAL_MS = 60000;
    
    /**
     * Load navbar HTML component
     * @param {Function} callback - Callback to execute after navbar loads
     */
    /**
     * Load navbar HTML component
     * @param {Function} callback - Callback to execute after navbar loads
     */
    
    // Inline navbar HTML for webOS compatibility (XHR fails on file:// protocol)
    var NAVBAR_HTML = '<div class="top-nav">' +
        '<div class="nav-left">' +
            '<button class="nav-btn nav-btn-icon" id="userBtn" tabindex="0">' +
                '<img class="user-avatar-img" id="userAvatarImg" src="" alt="User" style="display: none;">' +
                '<div class="user-avatar" id="userAvatar" style="display: none;"></div>' +
            '</button>' +
        '</div>' +
        '<div class="nav-center">' +
            '<div class="nav-pill">' +
                '<button class="nav-btn nav-btn-icon active" id="homeBtn" tabindex="0">' +
                    '<svg class="nav-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
                        '<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>' +
                    '</svg>' +
                '</button>' +
                '<button class="nav-btn nav-btn-icon" id="searchBtn" tabindex="0">' +
                    '<svg class="nav-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
                        '<path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>' +
                    '</svg>' +
                '</button>' +
                '<button class="nav-btn nav-btn-icon" id="shuffleBtn" tabindex="0">' +
                    '<svg class="nav-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
                        '<path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>' +
                    '</svg>' +
                '</button>' +
                '<button class="nav-btn nav-btn-icon" id="genresBtn" tabindex="0">' +
                    '<img class="nav-icon-img" src="assets/masks.png" alt="Genres">' +
                '</button>' +
                '<button class="nav-btn nav-btn-icon" id="favoritesBtn" tabindex="0">' +
                    '<svg class="nav-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
                        '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>' +
                    '</svg>' +
                '</button>' +
                '<button class="nav-btn nav-btn-icon" id="discoverBtn" tabindex="0" style="display: none;">' +
                    '<img class="nav-icon-img jellyseerr-icon" src="assets/jellyseer_jellyfish.png" alt="Discover">' +
                '</button>' +
                '<button class="nav-btn nav-btn-icon" id="settingsBtn" tabindex="0">' +
                    '<svg class="nav-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
                        '<path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>' +
                    '</svg>' +
                '</button>' +
            '</div>' +
        '</div>' +
        '<div class="nav-right">' +
            '<div class="clock" id="navClock">00:00</div>' +
        '</div>' +
    '</div>';
    
    function loadNavbar(callback) {
        // Check if navbar is already in the DOM
        if (document.getElementById('homeBtn')) {
            if (callback) callback();
            return;
        }
        
        // For webOS compatibility, inject navbar HTML directly instead of XHR
        // XHR fails on file:// protocol in older webOS versions
        var navbarContainer = document.createElement('div');
        navbarContainer.innerHTML = NAVBAR_HTML;
        document.body.insertBefore(navbarContainer.firstElementChild, document.body.firstChild);
        if (callback) callback();
    }
    
    /**
     * Initialize the navbar, load user info, libraries, and set up handlers
     */
    function initNavbar() {
        // Use MultiServerManager if available, otherwise fall back to JellyfinAPI
        var auth = typeof MultiServerManager !== 'undefined' 
            ? MultiServerManager.getAuthForPage() 
            : JellyfinAPI.getStoredAuth();
        
        if (!auth) return;
        
        var userAvatar = document.getElementById('userAvatar');
        var userAvatarImg = document.getElementById('userAvatarImg');
        
        if (userAvatar && auth.username) {
            userAvatar.textContent = auth.username.charAt(0).toUpperCase();
            userAvatar.style.display = 'flex';
        }
        
        if (userAvatarImg && auth.userId && auth.serverAddress) {
            var avatarUrl = auth.serverAddress + '/Users/' + auth.userId + '/Images/Primary?width=80&height=80&quality=90';
            var img = new Image();
            img.onload = function() {
                userAvatarImg.src = avatarUrl;
                userAvatarImg.style.display = 'block';
                if (userAvatar) {
                    userAvatar.style.display = 'none';
                }
            };
            img.onerror = function() {
                if (userAvatar) {
                    userAvatar.style.display = 'flex';
                }
            };
            img.src = avatarUrl;
        }
        
        // Load user libraries and add to navbar
        loadUserLibraries();
        
        // Apply Moonfin toolbar customization settings (includes Jellyseerr button handling)
        applyToolbarSettings();
        
        updateClock();
        setInterval(updateClock, CLOCK_UPDATE_INTERVAL_MS);
        
        setupNavbarHandlers();
    }
    
    /**
     * Apply toolbar settings from storage to the navbar
     */
    function applyToolbarSettings() {
        var settingsStr = storage.getUserPreference('jellyfin_settings', null);
        console.log('[Navbar] applyToolbarSettings - settingsStr:', settingsStr);
        if (!settingsStr) return;
        
        try {
            var settings = JSON.parse(settingsStr);
            
            var shuffleBtn = document.getElementById('shuffleBtn');
            var genresBtn = document.getElementById('genresBtn');
            var favoritesBtn = document.getElementById('favoritesBtn');
            var discoverBtn = document.getElementById('discoverBtn');
            
            if (shuffleBtn) {
                if (settings.showShuffleButton === false) {
                    console.log('[Navbar] Hiding shuffleBtn');
                    shuffleBtn.style.display = 'none';
                    shuffleBtn.style.pointerEvents = 'none';
                    shuffleBtn.setAttribute('tabindex', '-1');
                } else {
                    console.log('[Navbar] Showing shuffleBtn');
                    shuffleBtn.style.display = '';
                    shuffleBtn.style.pointerEvents = '';
                    shuffleBtn.setAttribute('tabindex', '0');
                }
            }
            
            if (genresBtn) {
                if (settings.showGenresButton === false) {
                    console.log('[Navbar] Hiding genresBtn');
                    genresBtn.style.display = 'none';
                    genresBtn.style.pointerEvents = 'none';
                    genresBtn.setAttribute('tabindex', '-1');
                } else {
                    console.log('[Navbar] Showing genresBtn');
                    genresBtn.style.display = '';
                    genresBtn.style.pointerEvents = '';
                    genresBtn.setAttribute('tabindex', '0');
                }
            }
            
            if (favoritesBtn) {
                if (settings.showFavoritesButton === false) {
                    console.log('[Navbar] Hiding favoritesBtn');
                    favoritesBtn.style.display = 'none';
                    favoritesBtn.style.pointerEvents = 'none';
                    favoritesBtn.setAttribute('tabindex', '-1');
                } else {
                    console.log('[Navbar] Showing favoritesBtn');
                    favoritesBtn.style.display = '';
                    favoritesBtn.style.pointerEvents = '';
                    favoritesBtn.setAttribute('tabindex', '0');
                }
            }
            
            // Discover button is controlled by Jellyseerr settings
            var jellyseerrEnabled = settings.jellyseerrEnabled;
            var jellyseerrShowDiscover = settings.jellyseerrShowDiscover !== false;
            
            if (discoverBtn) {
                if (!jellyseerrEnabled || !jellyseerrShowDiscover) {
                    console.log('[Navbar] Hiding discoverBtn');
                    // Hide button completely and make it unfocusable
                    discoverBtn.style.display = 'none';
                    discoverBtn.style.pointerEvents = 'none';
                    discoverBtn.setAttribute('tabindex', '-1');
                } else {
                    console.log('[Navbar] Showing discoverBtn');
                    discoverBtn.style.display = '';
                    discoverBtn.style.pointerEvents = '';
                    discoverBtn.setAttribute('tabindex', '0');
                }
            }
            
            // Hide/show library buttons
            var libraryButtons = document.querySelectorAll('.nav-btn[data-library-id]');
            libraryButtons.forEach(function(btn) {
                if (settings.showLibrariesInToolbar === false) {
                    console.log('[Navbar] Hiding library button:', btn.textContent.trim());
                    btn.style.display = 'none';
                    btn.style.pointerEvents = 'none';
                    btn.setAttribute('tabindex', '-1');
                } else {
                    console.log('[Navbar] Showing library button:', btn.textContent.trim());
                    btn.style.display = '';
                    btn.style.pointerEvents = '';
                    btn.setAttribute('tabindex', '0');
                }
            });
        } catch (e) {
            // Settings parsing failed, continue with defaults
        }
    }
    
    /**
     * Load user libraries and add them to the navbar
     */
    function loadUserLibraries() {
        // Use MultiServerManager if available, otherwise fall back to JellyfinAPI
        var auth = typeof MultiServerManager !== 'undefined' 
            ? MultiServerManager.getAuthForPage() 
            : JellyfinAPI.getStoredAuth();
        
        if (!auth) return;
        
        // Check if libraries are already loaded to prevent duplicates
        var navPill = document.querySelector('.nav-pill');
        if (!navPill) return;
        
        var existingLibraryButtons = navPill.querySelectorAll('.nav-btn[data-library-id]');
        if (existingLibraryButtons.length > 0) {
            // Libraries already loaded, skip
            return;
        }
        
        // Use ConnectionPool to get libraries from all servers if available
        if (typeof ConnectionPool !== 'undefined' && MultiServerManager.getServerCount() > 0) {
            ConnectionPool.getAllLibraries(function(err, allLibraries) {
                if (err || !allLibraries) {
                    console.error('Failed to load libraries from servers:', err);
                    return;
                }
                
                // Filter to supported collection types
                var libraries = allLibraries.filter(function(item) {
                    return item.CollectionType === 'movies' || 
                           item.CollectionType === 'tvshows' || 
                           item.CollectionType === 'music' ||
                           item.CollectionType === 'boxsets' ||
                           item.CollectionType === 'livetv';
                });
                
                renderLibraryButtons(libraries);
            });
        } else {
            // Fallback to single-server mode
            JellyfinAPI.getUserViews(auth.serverAddress, auth.userId, auth.accessToken, function(err, response) {
                if (err || !response || !response.Items) {
                    return;
                }
                
                var libraries = response.Items.filter(function(item) {
                    return item.CollectionType === 'movies' || 
                           item.CollectionType === 'tvshows' || 
                           item.CollectionType === 'music' ||
                           item.CollectionType === 'boxsets' ||
                           item.CollectionType === 'livetv';
                });
                
                // Add server info to libraries for consistency
                libraries.forEach(function(lib) {
                    lib.ServerId = null; // Single server mode
                    lib.ServerName = auth.serverName || 'Jellyfin Server';
                    lib.ServerUrl = auth.serverAddress;
                });
                
                renderLibraryButtons(libraries);
            });
        }
    }
    
    /**
     * Render library buttons in the navbar
     * @private
     * @param {Array} libraries - Array of library objects
     */
    function renderLibraryButtons(libraries) {
        var navPill = document.querySelector('.nav-pill');
        var settingsBtn = document.getElementById('settingsBtn');
        
        if (navPill && libraries.length > 0) {
            libraries.forEach(function(library) {
                var btn = document.createElement('button');
                btn.className = 'nav-btn';
                btn.setAttribute('tabindex', '0');
                btn.setAttribute('data-library-id', library.Id);
                if (library.ServerId) {
                    btn.setAttribute('data-server-id', library.ServerId);
                }
                
                var label = document.createElement('span');
                label.className = 'nav-label';
                
                // Only show server name if there are actually multiple servers
                var serverCount = typeof MultiServerManager !== 'undefined' ? MultiServerManager.getServerCount() : 0;
                if (library.ServerName && serverCount > 1) {
                    label.textContent = library.Name + ' (' + library.ServerName + ')';
                    btn.title = library.Name + ' - ' + library.ServerName;
                } else {
                    label.textContent = library.Name;
                }
                
                btn.appendChild(label);
                
                // Store the click handler so we can enable/disable it
                btn._libraryClickHandler = function() {
                    // Live TV goes to the guide page
                    if (library.CollectionType === 'livetv') {
                        // If multi-server, pass server ID
                        if (library.ServerId) {
                            window.location.href = 'live-tv.html?serverId=' + library.ServerId;
                        } else {
                            window.location.href = 'live-tv.html';
                        }
                    } else {
                        // Pass both library ID and server ID if available
                        var url = 'library.html?id=' + library.Id;
                        if (library.ServerId) {
                            url += '&serverId=' + library.ServerId;
                        }
                        window.location.href = url;
                    }
                };
                
                btn.addEventListener('click', btn._libraryClickHandler);
                
                btn.addEventListener('keydown', function(e) {
                    if (e.keyCode === KeyCodes.ENTER && btn.style.display !== 'none') {
                        e.preventDefault();
                        btn._libraryClickHandler();
                    }
                });
                
                btn.addEventListener('focus', function() {
                    console.log('[Navbar] Library button focused:', btn.textContent.trim(), 'display:', btn.style.display, 'tabindex:', btn.getAttribute('tabindex'));
                });
                
                // Append after settingsBtn (libraries come at the end)
                navPill.appendChild(btn);
            });
            
            // Apply toolbar settings after library buttons are added
            applyToolbarSettings();
            
            // Re-setup navigation to include library buttons
            setupNavbarNavigation();
        }
    }
    
    /**
     * Update the clock display in the navbar
     */
    function updateClock() {
        var clockElement = document.getElementById('navClock');
        if (!clockElement) return;
        
        // Check clock display setting (use user-scoped settings)
        var settings = storage.getUserPreference('jellyfin_settings', null);
        var use24Hour = false;
        if (settings) {
            if (typeof settings === 'string') settings = JSON.parse(settings);
            use24Hour = settings.clockDisplay === '24-hour';
        }
        
        var now = new Date();
        var hours = now.getHours();
        var minutes = now.getMinutes();
        
        minutes = minutes < 10 ? '0' + minutes : minutes;
        
        if (use24Hour) {
            // 24-hour format
            hours = hours < 10 ? '0' + hours : hours;
            clockElement.textContent = hours + ':' + minutes;
        } else {
            // 12-hour format with AM/PM
            var ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // 0 becomes 12
            clockElement.textContent = hours + ':' + minutes + ' ' + ampm;
        }
    }
    
    /**
     * Handle click on the shuffle button to play a random item
     */
    function handleShuffleClick() {
        
        var auth = JellyfinAPI.getStoredAuth();
        if (!auth) {
            return;
        }
        
        // Fetch random movie or TV show (exclude BoxSets/Collections)
        var params = {
            userId: auth.userId,
            limit: 1,
            includeItemTypes: 'Movie,Series',
            filters: 'IsNotFolder',
            sortBy: 'Random',
            fields: 'PrimaryImageAspectRatio,BasicSyncInfo',
            recursive: true,
            excludeItemTypes: 'BoxSet'
        };
        
        JellyfinAPI.getItems(auth.serverAddress, auth.accessToken, '/Users/' + auth.userId + '/Items', params, function(err, data) {
            if (err || !data || !data.Items || data.Items.length === 0) {
                return;
            }
            
            var randomItem = data.Items[0];
            window.location.href = 'details.html?id=' + randomItem.Id;
        });
    }
    
    /**
     * Set up event handlers for all navbar buttons
     */
    function setupNavbarHandlers() {
        var homeBtn = document.getElementById('homeBtn');
        var searchBtn = document.getElementById('searchBtn');
        var shuffleBtn = document.getElementById('shuffleBtn');
        var genresBtn = document.getElementById('genresBtn');
        var favoritesBtn = document.getElementById('favoritesBtn');
        var discoverBtn = document.getElementById('discoverBtn');
        var settingsBtn = document.getElementById('settingsBtn');
        var userBtn = document.getElementById('userBtn');
        
        function handleUserLogout() {
            if (typeof JellyfinAPI !== 'undefined') {
                
                // Get the current server info before logging out
                var auth = JellyfinAPI.getStoredAuth();
                var serverAddress = auth ? auth.serverAddress : null;
                
                // Logout (clears jellyfin_auth)
                JellyfinAPI.logout();
                
                // Redirect to login page
                // The login page will automatically load users for the last connected server
                window.location.href = 'login.html';
            }
        }
        
        if (homeBtn) {
            homeBtn.addEventListener('click', function() {
                window.location.href = 'browse.html';
            });
            homeBtn.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) {
                    e.preventDefault();
                    window.location.href = 'browse.html';
                }
            });
            homeBtn.addEventListener('focus', function() {
                console.log('[Navbar] homeBtn focused - display:', homeBtn.style.display, 'tabindex:', homeBtn.getAttribute('tabindex'));
            });
        }
        
        if (searchBtn) {
            searchBtn.addEventListener('click', function() {
                window.location.href = 'search.html';
            });
            searchBtn.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) {
                    e.preventDefault();
                    window.location.href = 'search.html';
                }
            });
            searchBtn.addEventListener('focus', function() {
                console.log('[Navbar] searchBtn focused - display:', searchBtn.style.display, 'tabindex:', searchBtn.getAttribute('tabindex'));
            });
        }
        
        if (shuffleBtn) {
            shuffleBtn._clickHandler = function() {
                handleShuffleClick();
            };
            
            shuffleBtn.addEventListener('click', shuffleBtn._clickHandler);
            shuffleBtn.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER && shuffleBtn.style.display !== 'none') {
                    e.preventDefault();
                    handleShuffleClick();
                }
            });
            shuffleBtn.addEventListener('focus', function() {
                console.log('[Navbar] shuffleBtn focused - display:', shuffleBtn.style.display, 'tabindex:', shuffleBtn.getAttribute('tabindex'));
            });
        }
        
        if (genresBtn) {
            genresBtn._clickHandler = function() {
                window.location.href = 'genres.html';
            };
            
            genresBtn.addEventListener('click', genresBtn._clickHandler);
            genresBtn.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER && genresBtn.style.display !== 'none') {
                    e.preventDefault();
                    window.location.href = 'genres.html';
                }
            });
            genresBtn.addEventListener('focus', function() {
                console.log('[Navbar] genresBtn focused - display:', genresBtn.style.display, 'tabindex:', genresBtn.getAttribute('tabindex'));
            });
        }
        
        if (favoritesBtn) {
            favoritesBtn._clickHandler = function() {
                window.location.href = 'favorites.html';
            };
            
            favoritesBtn.addEventListener('click', favoritesBtn._clickHandler);
            favoritesBtn.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER && favoritesBtn.style.display !== 'none') {
                    e.preventDefault();
                    window.location.href = 'favorites.html';
                }
            });
            favoritesBtn.addEventListener('focus', function() {
                console.log('[Navbar] favoritesBtn focused - display:', favoritesBtn.style.display, 'tabindex:', favoritesBtn.getAttribute('tabindex'));
            });
        }
        
        if (discoverBtn) {
            discoverBtn.addEventListener('click', function() {
                window.location.href = 'discover.html';
            });
            discoverBtn.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) {
                    e.preventDefault();
                    window.location.href = 'discover.html';
                }
            });
            discoverBtn.addEventListener('focus', function() {
                console.log('[Navbar] discoverBtn focused - display:', discoverBtn.style.display, 'tabindex:', discoverBtn.getAttribute('tabindex'));
            });
        }
        
        if (settingsBtn) {
            settingsBtn.addEventListener('click', function() {
                window.location.href = 'settings.html';
            });
            settingsBtn.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) {
                    e.preventDefault();
                    window.location.href = 'settings.html';
                }
            });
            settingsBtn.addEventListener('focus', function() {
                console.log('[Navbar] settingsBtn focused - display:', settingsBtn.style.display, 'tabindex:', settingsBtn.getAttribute('tabindex'));
            });
        }
        
        if (userBtn) {
            userBtn.addEventListener('click', handleUserLogout);
            userBtn.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) {
                    e.preventDefault();
                    handleUserLogout();
                }
            });
        }
        
        // Add global navigation handler for all navbar buttons
        setupNavbarNavigation();
    }
    
    /**
     * Set up keyboard navigation for navbar buttons
     */
    function setupNavbarNavigation() {
        var navButtons = document.querySelectorAll('.nav-btn');
        
        navButtons.forEach(function(button, index) {
            // Remove existing listener if it exists to avoid duplicates
            if (button._navKeydownHandler) {
                button.removeEventListener('keydown', button._navKeydownHandler);
            }
            
            // Create and store the handler
            button._navKeydownHandler = function(e) {
                // Only get visible buttons for navigation
                var allButtons = Array.from(document.querySelectorAll('.nav-btn')).filter(function(btn) {
                    return btn.offsetParent !== null; // Check if button is visible
                });
                
                console.log('[Navbar] Navigation - Visible buttons:', allButtons.map(function(b) { 
                    return b.id || b.textContent.trim(); 
                }));
                
                var currentIndex = allButtons.indexOf(button);
                console.log('[Navbar] Current button index:', currentIndex, 'id:', button.id || button.textContent.trim());
                
                if (e.keyCode === KeyCodes.LEFT) {
                    e.preventDefault();
                    if (currentIndex > 0) {
                        console.log('[Navbar] Moving LEFT to:', allButtons[currentIndex - 1].id || allButtons[currentIndex - 1].textContent.trim());
                        allButtons[currentIndex - 1].focus();
                        scrollNavButtonIntoView(allButtons[currentIndex - 1]);
                    }
                } else if (e.keyCode === KeyCodes.RIGHT) {
                    e.preventDefault();
                    if (currentIndex < allButtons.length - 1) {
                        console.log('[Navbar] Moving RIGHT to:', allButtons[currentIndex + 1].id || allButtons[currentIndex + 1].textContent.trim());
                        allButtons[currentIndex + 1].focus();
                        scrollNavButtonIntoView(allButtons[currentIndex + 1]);
                    }
                }
            };
            
            button.addEventListener('keydown', button._navKeydownHandler);
        });
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            loadNavbar(initNavbar);
        });
    } else {
        loadNavbar(initNavbar);
    }
    
    window.NavbarController = {
        load: loadNavbar,
        init: function(activePage) {
            initNavbar();
            setActivePage(activePage);
        },
        focusNavbar: function() {
            var homeBtn = document.getElementById('homeBtn');
            if (homeBtn) {
                homeBtn.focus();
            }
        },
        scrollNavButtonIntoView: scrollNavButtonIntoView,
        updateClock: updateClock
    };
    
    /**
     * Set the active page in the navbar
     * @param {string} page - Page identifier
     */
    function setActivePage(page) {
        // Remove active class from all buttons
        var buttons = document.querySelectorAll('.nav-btn');
        buttons.forEach(function(btn) {
            btn.classList.remove('active');
        });
        
        // Add active class to the appropriate button
        var activeBtn = null;
        switch(page) {
            case 'browse':
            case 'home':
                activeBtn = document.getElementById('homeBtn');
                break;
            case 'search':
                activeBtn = document.getElementById('searchBtn');
                break;
            case 'genres':
                activeBtn = document.getElementById('genresBtn');
                break;
            case 'favorites':
                activeBtn = document.getElementById('favoritesBtn');
                break;
            case 'discover':
                activeBtn = document.getElementById('discoverBtn');
                break;
            case 'settings':
                activeBtn = document.getElementById('settingsBtn');
                break;
        }
        
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }
    
    /**
     * Scroll a navbar button into view within the nav-pill container
     * @param {HTMLElement} button - The button to scroll into view
     */
    /**
     * Scroll a navbar button into view within the nav-pill container
     * @param {HTMLElement} button - The button to scroll into view
     */
    function scrollNavButtonIntoView(button) {
        if (!button) return;
        
        var navPill = document.querySelector('.nav-pill');
        if (!navPill) return;
        
        var buttonLeft = button.offsetLeft;
        var buttonRight = buttonLeft + button.offsetWidth;
        var scrollLeft = navPill.scrollLeft;
        var pillWidth = navPill.offsetWidth;
        
        var SCROLL_PADDING = 20;
        
        // Check if button is out of view on the right
        if (buttonRight > scrollLeft + pillWidth) {
            navPill.scrollLeft = buttonRight - pillWidth + SCROLL_PADDING;
        }
        // Check if button is out of view on the left
        else if (buttonLeft < scrollLeft) {
            navPill.scrollLeft = buttonLeft - SCROLL_PADDING;
        }
    }
})();
