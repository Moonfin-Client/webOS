(function() {
    'use strict';
    
    // Constants
    const CLOCK_UPDATE_INTERVAL_MS = 60000; // Update clock every minute
    
    function loadNavbar(callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'components/navbar.html', true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    var navbarContainer = document.createElement('div');
                    navbarContainer.innerHTML = xhr.responseText;
                    document.body.insertBefore(navbarContainer.firstElementChild, document.body.firstChild);
                    if (callback) callback();
                } else {
                    if (typeof JellyfinAPI !== 'undefined') {
                    }
                }
            }
        };
        xhr.send();
    }
    
    function initNavbar() {
        var auth = JellyfinAPI.getStoredAuth();
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
    
    function applyToolbarSettings() {
        var settingsStr = storage.get('jellyfin_settings');
        if (!settingsStr) return;
        
        try {
            var settings = JSON.parse(settingsStr);
            
            var shuffleBtn = document.getElementById('shuffleBtn');
            var genresBtn = document.getElementById('genresBtn');
            var favoritesBtn = document.getElementById('favoritesBtn');
            var discoverBtn = document.getElementById('discoverBtn');
            
            if (shuffleBtn) {
                shuffleBtn.style.display = (settings.showShuffleButton === false) ? 'none' : '';
            }
            
            if (genresBtn) {
                genresBtn.style.display = (settings.showGenresButton === false) ? 'none' : '';
            }
            
            if (favoritesBtn) {
                favoritesBtn.style.display = (settings.showFavoritesButton === false) ? 'none' : '';
            }
            
            // Discover button is controlled by Jellyseerr settings
            var jellyseerrEnabled = settings.jellyseerrEnabled;
            var jellyseerrShowDiscover = settings.jellyseerrShowDiscover !== false;
            
            if (discoverBtn) {
                if (!jellyseerrEnabled || !jellyseerrShowDiscover) {
                    // Remove from DOM completely
                    discoverBtn.remove();
                } else {
                    discoverBtn.style.display = '';
                }
            }
            
            // Hide/show library buttons
            var libraryButtons = document.querySelectorAll('.nav-btn[data-library-id]');
            libraryButtons.forEach(function(btn) {
                btn.style.display = (settings.showLibrariesInToolbar === false) ? 'none' : '';
            });
        } catch (e) {
            // Settings parsing failed, continue with defaults
        }
    }
    
    function loadUserLibraries() {
        var auth = JellyfinAPI.getStoredAuth();
        if (!auth) return;
        
        // Check if libraries are already loaded to prevent duplicates
        var navPill = document.querySelector('.nav-pill');
        if (!navPill) return;
        
        var existingLibraryButtons = navPill.querySelectorAll('.nav-btn[data-library-id]');
        if (existingLibraryButtons.length > 0) {
            // Libraries already loaded, skip
            return;
        }
        
        JellyfinAPI.getUserViews(auth.serverAddress, auth.userId, auth.accessToken, function(err, response) {
            if (err || !response || !response.Items) {
                return;
            }
            
            var libraries = response.Items.filter(function(item) {
                return item.CollectionType === 'movies' || 
                       item.CollectionType === 'tvshows' || 
                       item.CollectionType === 'music' ||
                       item.CollectionType === 'boxsets';
            });
            
            var settingsBtn = document.getElementById('settingsBtn');
            
            if (navPill && libraries.length > 0) {
                libraries.forEach(function(library) {
                    var btn = document.createElement('button');
                    btn.className = 'nav-btn';
                    btn.setAttribute('tabindex', '0');
                    btn.setAttribute('data-library-id', library.Id);
                    
                    var label = document.createElement('span');
                    label.className = 'nav-label';
                    label.textContent = library.Name;
                    
                    btn.appendChild(label);
                    
                    btn.addEventListener('click', function() {
                        window.location.href = 'library.html?id=' + library.Id;
                    });
                    
                    // Append after settingsBtn (libraries come at the end)
                    navPill.appendChild(btn);
                });
                
                // Apply toolbar settings after library buttons are added
                applyToolbarSettings();
            }
        });
    }
    
    function updateClock() {
        var clockElement = document.getElementById('navClock');
        if (!clockElement) return;
        
        // Check clock display setting
        var settings = storage.get('jellyfin_settings');
        var use24Hour = settings && JSON.parse(settings).clockDisplay === '24-hour';
        
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
        }
        
        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', function() {
                handleShuffleClick();
            });
            shuffleBtn.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) {
                    e.preventDefault();
                    handleShuffleClick();
                }
            });
        }
        
        if (genresBtn) {
            genresBtn.addEventListener('click', function() {
                window.location.href = 'genres.html';
            });
            genresBtn.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) {
                    e.preventDefault();
                    window.location.href = 'genres.html';
                }
            });
        }
        
        if (favoritesBtn) {
            favoritesBtn.addEventListener('click', function() {
                window.location.href = 'favorites.html';
            });
            favoritesBtn.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) {
                    e.preventDefault();
                    window.location.href = 'favorites.html';
                }
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
    
    function setupNavbarNavigation() {
        var navButtons = document.querySelectorAll('.nav-btn');
        
        navButtons.forEach(function(button, index) {
            button.addEventListener('keydown', function(e) {
                // Only get visible buttons for navigation
                var allButtons = Array.from(document.querySelectorAll('.nav-btn')).filter(function(btn) {
                    return btn.offsetParent !== null; // Check if button is visible
                });
                var currentIndex = allButtons.indexOf(button);
                
                if (e.keyCode === KeyCodes.LEFT) {
                    e.preventDefault();
                    if (currentIndex > 0) {
                        allButtons[currentIndex - 1].focus();
                    }
                } else if (e.keyCode === KeyCodes.RIGHT) {
                    e.preventDefault();
                    if (currentIndex < allButtons.length - 1) {
                        allButtons[currentIndex + 1].focus();
                    }
                }
            });
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
