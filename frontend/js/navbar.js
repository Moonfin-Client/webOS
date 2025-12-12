(function() {
    'use strict';
    
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
                        JellyfinAPI.Logger.error('Failed to load navbar:', xhr.status);
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
        
        // Apply Moonfin toolbar customization settings
        applyToolbarSettings();
        
        updateClock();
        setInterval(updateClock, 60000);
        
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
            
            if (shuffleBtn) {
                shuffleBtn.style.display = (settings.showShuffleButton === false) ? 'none' : '';
            }
            
            if (genresBtn) {
                genresBtn.style.display = (settings.showGenresButton === false) ? 'none' : '';
            }
            
            if (favoritesBtn) {
                favoritesBtn.style.display = (settings.showFavoritesButton === false) ? 'none' : '';
            }
            
            // Hide/show library buttons
            var libraryButtons = document.querySelectorAll('.nav-btn[data-library-id]');
            libraryButtons.forEach(function(btn) {
                btn.style.display = (settings.showLibrariesInToolbar === false) ? 'none' : '';
            });
        } catch (e) {
            if (typeof JellyfinAPI !== 'undefined') {
                JellyfinAPI.Logger.error('Failed to parse settings:', e);
            }
        }
    }
    
    function loadUserLibraries() {
        var auth = JellyfinAPI.getStoredAuth();
        if (!auth) return;
        
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
            
            var navPill = document.querySelector('.nav-pill');
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
        
        var now = new Date();
        var hours = now.getHours();
        var minutes = now.getMinutes();
        var ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 becomes 12
        minutes = minutes < 10 ? '0' + minutes : minutes;
        
        clockElement.textContent = hours + ':' + minutes + ' ' + ampm;
    }
    
    function handleShuffleClick() {
        JellyfinAPI.Logger.info('Shuffle button clicked');
        
        var auth = JellyfinAPI.getStoredAuth();
        if (!auth) {
            JellyfinAPI.Logger.error('No authentication found');
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
                JellyfinAPI.Logger.error('Failed to get random item:', err);
                return;
            }
            
            var randomItem = data.Items[0];
            JellyfinAPI.Logger.success('Random item selected:', randomItem.Name, randomItem.Type);
            window.location.href = 'details.html?id=' + randomItem.Id;
        });
    }
    
    function setupNavbarHandlers() {
        var homeBtn = document.getElementById('homeBtn');
        var searchBtn = document.getElementById('searchBtn');
        var shuffleBtn = document.getElementById('shuffleBtn');
        var genresBtn = document.getElementById('genresBtn');
        var favoritesBtn = document.getElementById('favoritesBtn');
        var settingsBtn = document.getElementById('settingsBtn');
        var userBtn = document.getElementById('userBtn');
        
        function handleUserLogout() {
            if (typeof JellyfinAPI !== 'undefined') {
                JellyfinAPI.Logger.info('Logging out user...');
                
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
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            loadNavbar(initNavbar);
        });
    } else {
        loadNavbar(initNavbar);
    }
    
    window.NavbarComponent = {
        load: loadNavbar,
        init: initNavbar
    };
})();
