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
                    console.error('Failed to load navbar:', xhr.status);
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
        
        setupNavbarHandlers();
    }
    
    function setupNavbarHandlers() {
        var homeBtn = document.getElementById('homeBtn');
        var searchBtn = document.getElementById('searchBtn');
        var settingsBtn = document.getElementById('settingsBtn');
        var userBtn = document.getElementById('userBtn');
        
        if (homeBtn) {
            homeBtn.addEventListener('click', function() {
                window.location.href = 'browse.html';
            });
        }
        
        if (searchBtn) {
            searchBtn.addEventListener('click', function() {
                // TODO: Implement search
                console.log('Search not yet implemented');
            });
        }
        
        if (settingsBtn) {
            settingsBtn.addEventListener('click', function() {
                window.location.href = 'settings.html';
            });
        }
        
        if (userBtn) {
            userBtn.addEventListener('click', function() {
                console.log('User menu not yet implemented');
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
