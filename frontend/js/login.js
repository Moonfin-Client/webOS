var LoginController = (function() {
    'use strict';

    var currentServers = [];
    var selectedServerIndex = -1;
    var connectedServer = null;
    var publicUsers = [];
    var selectedUser = null;
    var quickConnectSecret = null;
    var quickConnectInterval = null;
    var elements = {};

    function init() {
        JellyfinAPI.Logger.info('Initializing login controller...');
        JellyfinAPI.init();
        cacheElements();
        setupEventListeners();
        
        // Check if user has valid auth
        var hasAuth = checkStoredAuth();
        
        // If no valid auth, check for last server connection to show user selection
        if (!hasAuth) {
            checkLastServer();
        }
        
        startServerDiscovery();
    }

    function cacheElements() {
        elements = {
            serverUrlInput: document.getElementById('serverUrl'),
            connectBtn: document.getElementById('connectBtn'),
            discoverBtn: document.getElementById('discoverBtn'),
            serverList: document.getElementById('serverList'),
            
            userSelection: document.getElementById('userSelection'),
            userRow: document.getElementById('userRow'),
            
            loginForm: document.getElementById('loginForm'),
            useQuickConnectBtn: document.getElementById('useQuickConnectBtn'),
            usePasswordBtn: document.getElementById('usePasswordBtn'),
            
            passwordForm: document.getElementById('passwordForm'),
            passwordInput: document.getElementById('password'),
            selectedUserAvatar: document.getElementById('selectedUserAvatar'),
            selectedUserName: document.getElementById('selectedUserName'),
            loginBtn: document.getElementById('loginBtn'),
            cancelLoginBtn: document.getElementById('cancelLoginBtn'),
            
            quickConnectForm: document.getElementById('quickConnectForm'),
            qcSelectedUserAvatar: document.getElementById('qcSelectedUserAvatar'),
            qcSelectedUserName: document.getElementById('qcSelectedUserName'),
            quickConnectCode: document.getElementById('quickConnectCode'),
            quickConnectStatus: document.getElementById('quickConnectStatus'),
            cancelQuickConnectBtn: document.getElementById('cancelQuickConnectBtn'),
            
            backToServerBtn: document.getElementById('backToServerBtn'),
            
            errorMessage: document.getElementById('errorMessage'),
            statusMessage: document.getElementById('statusMessage'),
            manualServerSection: document.getElementById('manualServerSection'),
            discoveredServersSection: document.getElementById('discoveredServersSection')
        };
    }

    function setupEventListeners() {
        if (elements.connectBtn) {
            elements.connectBtn.addEventListener('click', handleConnect);
        }
        if (elements.discoverBtn) {
            elements.discoverBtn.addEventListener('click', startServerDiscovery);
        }
        if (elements.serverUrlInput) {
            elements.serverUrlInput.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) handleConnect();
            });
        }
        
        // Login form listeners
        if (elements.useQuickConnectBtn) {
            elements.useQuickConnectBtn.addEventListener('click', showQuickConnectForm);
        }
        if (elements.usePasswordBtn) {
            elements.usePasswordBtn.addEventListener('click', showPasswordForm);
        }
        if (elements.loginBtn) {
            elements.loginBtn.addEventListener('click', handlePasswordLogin);
        }
        if (elements.cancelLoginBtn) {
            elements.cancelLoginBtn.addEventListener('click', backToUserSelection);
        }
        if (elements.cancelQuickConnectBtn) {
            elements.cancelQuickConnectBtn.addEventListener('click', backToUserSelection);
        }
        if (elements.backToServerBtn) {
            elements.backToServerBtn.addEventListener('click', backToServerSelection);
        }
        if (elements.passwordInput) {
            elements.passwordInput.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) handlePasswordLogin();
            });
        }
    }

    function checkStoredAuth() {
        var auth = JellyfinAPI.getStoredAuth();
        if (auth) {
            showStatus('Resuming session as ' + auth.username + '...', 'info');
            setTimeout(function() {
                window.location.href = 'browse.html';
            }, 500);
            return true;
        }
        return false;
    }

    function checkLastServer() {
        // Check if there's a stored server connection (for returning from logout)
        var lastServer = storage.get('last_server', true);
        
        if (lastServer && lastServer.address) {
            JellyfinAPI.Logger.info('Reconnecting to last server:', lastServer.name);
            
            // Set the server URL
            if (elements.serverUrlInput) {
                elements.serverUrlInput.value = lastServer.address;
            }
            
            // Automatically connect and show user selection
            setTimeout(function() {
                handleConnect();
            }, 100);
        }
    }

    function startServerDiscovery() {
        showStatus('Discovering servers on your network...', 'info');
        clearError();
        
        if (elements.discoverBtn) {
            elements.discoverBtn.disabled = true;
            elements.discoverBtn.textContent = 'Searching...';
        }
        
        JellyfinAPI.discoverServers(function(err, servers) {
            if (elements.discoverBtn) {
                elements.discoverBtn.disabled = false;
                elements.discoverBtn.textContent = 'Discover Servers';
            }
            
            if (err) {
                clearStatus();
                renderServerList([]);
            } else {
                currentServers = Array.isArray(servers) ? servers : [servers];
                if (currentServers.length > 0) {
                    showStatus('Found ' + currentServers.length + ' server(s)!', 'success');
                } else {
                    clearStatus();
                }
                renderServerList(currentServers);
            }
        });
    }

    function renderServerList(servers) {
        if (!elements.serverList) return;
        
        elements.serverList.innerHTML = '';
        
        if (servers.length === 0) {
            elements.serverList.innerHTML = '<li class="server-item empty">No servers discovered</li>';
            if (elements.discoveredServersSection) {
                elements.discoveredServersSection.style.display = 'none';
            }
            return;
        }
        
        if (elements.discoveredServersSection) {
            elements.discoveredServersSection.style.display = 'block';
        }
        
        servers.forEach(function(server, index) {
            var li = document.createElement('li');
            li.className = 'server-item';
            li.setAttribute('tabindex', '0');
            
            var nameDiv = document.createElement('div');
            nameDiv.className = 'server-name';
            nameDiv.textContent = server.name || 'Jellyfin Server';
            
            var addressDiv = document.createElement('div');
            addressDiv.className = 'server-address';
            addressDiv.textContent = server.address;
            
            var versionDiv = document.createElement('div');
            versionDiv.className = 'server-version';
            versionDiv.textContent = 'Version: ' + (server.version || 'Unknown');
            
            li.appendChild(nameDiv);
            li.appendChild(addressDiv);
            li.appendChild(versionDiv);
            
            li.addEventListener('click', function() {
                selectServer(index);
            });
            
            li.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) {
                    selectServer(index);
                }
            });
            
            elements.serverList.appendChild(li);
        });
    }

    function selectServer(index) {
        selectedServerIndex = index;
        var server = currentServers[index];
        
        var allItems = elements.serverList.querySelectorAll('.server-item');
        allItems.forEach(function(item, i) {
            if (i === index) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        
        if (elements.serverUrlInput) {
            elements.serverUrlInput.value = server.address;
        }
        
        showStatus('Selected: ' + server.name, 'success');
        JellyfinAPI.Logger.info('Server selected:', server);
        
        handleConnect();
    }

    function handleConnect() {
        var serverUrl = elements.serverUrlInput.value.trim();
        
        if (!serverUrl) {
            showError('Please enter a server address or select a discovered server');
            return;
        }
        
        serverUrl = JellyfinAPI.normalizeServerAddress(serverUrl);
        elements.serverUrlInput.value = serverUrl;
        
        showStatus('Testing connection to ' + serverUrl + '...', 'info');
        clearError();
        
        if (elements.connectBtn) {
            elements.connectBtn.disabled = true;
            elements.connectBtn.textContent = 'Connecting...';
        }
        
        JellyfinAPI.testServer(serverUrl, function(err, serverInfo) {
            if (elements.connectBtn) {
                elements.connectBtn.disabled = false;
                elements.connectBtn.textContent = 'Test Connection';
            }
            
            if (err) {
                showError('Unable to connect to server. Check the address and try again.');
                JellyfinAPI.Logger.error('Connection test failed', err);
            } else {
                showStatus('Connected to ' + serverInfo.name + '! Loading users...', 'success');
                JellyfinAPI.Logger.success('Server connection verified', serverInfo);
                
                connectedServer = serverInfo;
                
                // Store the server info for returning after logout
                storage.set('last_server', {
                    name: serverInfo.name,
                    address: serverInfo.address,
                    id: serverInfo.id,
                    version: serverInfo.version
                }, true);
                
                loadPublicUsers(serverInfo.address);
            }
        });
    }

    function loadPublicUsers(serverAddress) {
        JellyfinAPI.getPublicUsers(serverAddress, function(err, users) {
            if (err) {
                showError('Connected to server but failed to load users');
                JellyfinAPI.Logger.error('Failed to load public users', err);
                return;
            }
            
            publicUsers = users;
            
            // Hide server selection
            if (elements.manualServerSection) {
                elements.manualServerSection.style.display = 'none';
            }
            if (elements.discoveredServersSection) {
                elements.discoveredServersSection.style.display = 'none';
            }
            
            // Show user selection
            renderUserRow(users);
            if (elements.userSelection) {
                elements.userSelection.style.display = 'block';
            }
            
            clearStatus();
        });
    }

    function renderUserRow(users) {
        if (!elements.userRow) return;
        
        elements.userRow.innerHTML = '';
        
        if (users.length === 0) {
            elements.userRow.innerHTML = '<div class="user-card"><div class="user-name">No users found</div></div>';
            return;
        }
        
        users.forEach(function(user, index) {
            var userCard = document.createElement('div');
            userCard.className = 'user-card';
            userCard.setAttribute('tabindex', '0');
            userCard.setAttribute('data-user-index', index);
            
            var avatar = document.createElement('div');
            avatar.className = 'user-avatar';
            
            if (user.PrimaryImageTag) {
                var imgUrl = JellyfinAPI.getUserImageUrl(connectedServer.address, user.Id, user.PrimaryImageTag);
                var img = document.createElement('img');
                img.src = imgUrl;
                img.alt = user.Name;
                avatar.appendChild(img);
            } else {
                avatar.classList.add('no-image');
            }
            
            var userName = document.createElement('div');
            userName.className = 'user-name';
            userName.textContent = user.Name;
            
            userCard.appendChild(avatar);
            userCard.appendChild(userName);
            
            userCard.addEventListener('click', function() {
                selectUser(index);
            });
            
            userCard.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) {
                    selectUser(index);
                }
            });
            
            elements.userRow.appendChild(userCard);
        });
        
        // Focus the first user card
        if (users.length > 0) {
            setTimeout(function() {
                var firstCard = elements.userRow.querySelector('.user-card');
                if (firstCard) {
                    firstCard.focus();
                }
            }, 100);
        }
    }

    function selectUser(index) {
        selectedUser = publicUsers[index];
        
        // Update UI to show selected state
        var allCards = elements.userRow.querySelectorAll('.user-card');
        allCards.forEach(function(card, i) {
            if (i === index) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
        
        JellyfinAPI.Logger.info('User selected:', selectedUser.Name);
        
        // Show login options
        showLoginOptions();
    }

    function showLoginOptions() {
        if (elements.userSelection) {
            elements.userSelection.style.display = 'none';
        }
        if (elements.loginForm) {
            elements.loginForm.style.display = 'block';
        }
        if (elements.useQuickConnectBtn) {
            elements.useQuickConnectBtn.style.display = 'inline-block';
        }
        if (elements.usePasswordBtn) {
            elements.usePasswordBtn.style.display = 'inline-block';
        }
        
        // Default to password form
        showPasswordForm();
    }

    function showPasswordForm() {
        hideAllLoginMethods();
        
        if (elements.passwordForm) {
            elements.passwordForm.style.display = 'block';
        }
        
        // Update user info
        updateSelectedUserInfo(elements.selectedUserAvatar, elements.selectedUserName);
        
        if (elements.passwordInput) {
            elements.passwordInput.value = '';
            elements.passwordInput.focus();
        }
    }

    function showQuickConnectForm() {
        hideAllLoginMethods();
        
        if (elements.quickConnectForm) {
            elements.quickConnectForm.style.display = 'block';
        }
        
        // Update user info
        updateSelectedUserInfo(elements.qcSelectedUserAvatar, elements.qcSelectedUserName);
        
        // Initiate Quick Connect
        initiateQuickConnect();
    }

    function hideAllLoginMethods() {
        if (elements.passwordForm) {
            elements.passwordForm.style.display = 'none';
        }
        if (elements.quickConnectForm) {
            elements.quickConnectForm.style.display = 'none';
        }
    }

    function updateSelectedUserInfo(avatarElement, nameElement) {
        if (!selectedUser) return;
        
        if (nameElement) {
            nameElement.textContent = selectedUser.Name;
        }
        
        if (avatarElement) {
            if (selectedUser.PrimaryImageTag) {
                var imgUrl = JellyfinAPI.getUserImageUrl(connectedServer.address, selectedUser.Id, selectedUser.PrimaryImageTag);
                avatarElement.src = imgUrl;
                avatarElement.classList.remove('no-image');
            } else {
                avatarElement.src = '';
                avatarElement.classList.add('no-image');
            }
        }
    }

    function backToUserSelection() {
        stopQuickConnect();
        
        if (elements.loginForm) {
            elements.loginForm.style.display = 'none';
        }
        if (elements.userSelection) {
            elements.userSelection.style.display = 'block';
        }
        
        selectedUser = null;
        clearError();
    }

    function backToServerSelection() {
        // Clear all connection state
        connectedServer = null;
        publicUsers = [];
        selectedUser = null;
        stopQuickConnect();
        storage.remove('last_server');
        
        // Hide user selection and login forms
        if (elements.userSelection) {
            elements.userSelection.style.display = 'none';
        }
        if (elements.loginForm) {
            elements.loginForm.style.display = 'none';
        }
        
        // Show manual server section
        if (elements.manualServerSection) {
            elements.manualServerSection.style.display = 'block';
        }
        if (elements.serverUrlInput) {
            elements.serverUrlInput.focus();
        }
        
        clearError();
        clearStatus();
    }

    function handlePasswordLogin() {
        if (!selectedUser || !connectedServer) {
            showError('Please select a user first');
            return;
        }
        
        var password = elements.passwordInput.value; // Don't trim - preserve empty string
        
        // Password can be empty (Jellyfin supports passwordless users)
        if (password === null || password === undefined) {
            showError('Password field is invalid');
            return;
        }
        
        showStatus('Logging in as ' + selectedUser.Name + '...', 'info');
        clearError();
        
        if (elements.loginBtn) {
            elements.loginBtn.disabled = true;
            elements.loginBtn.textContent = 'Logging in...';
        }
        
        JellyfinAPI.authenticateByName(connectedServer.address, selectedUser.Name, password, function(err, authData) {
            if (elements.loginBtn) {
                elements.loginBtn.disabled = false;
                elements.loginBtn.textContent = 'Login';
            }
            
            if (err) {
                showError('Login failed! Check your password.');
                JellyfinAPI.Logger.error('Authentication failed', err);
            } else {
                showStatus('Login successful! Welcome, ' + authData.username + '!', 'success');
                JellyfinAPI.Logger.success('Login successful', authData);
                
                elements.passwordInput.value = '';
                
                setTimeout(function() {
                    window.location.href = 'browse.html';
                }, 1000);
            }
        });
    }

    function initiateQuickConnect() {
        if (!connectedServer) {
            showError('No server connected');
            return;
        }
        
        if (elements.quickConnectCode) {
            elements.quickConnectCode.textContent = '------';
        }
        if (elements.quickConnectStatus) {
            elements.quickConnectStatus.textContent = 'Initiating Quick Connect...';
            elements.quickConnectStatus.classList.remove('authenticated');
        }
        
        JellyfinAPI.initiateQuickConnect(connectedServer.address, function(err, response) {
            if (err) {
                showError('Quick Connect is not enabled on this server');
                JellyfinAPI.Logger.error('Quick Connect initiation failed', err);
                backToUserSelection();
                return;
            }
            
            quickConnectSecret = response.Secret;
            
            if (elements.quickConnectCode) {
                elements.quickConnectCode.textContent = response.Code;
            }
            if (elements.quickConnectStatus) {
                elements.quickConnectStatus.textContent = 'Waiting for authentication...';
            }
            
            // Start polling for status
            startQuickConnectPolling();
        });
    }

    function startQuickConnectPolling() {
        // Clear any existing interval (but don't clear the secret!)
        if (quickConnectInterval) {
            clearInterval(quickConnectInterval);
            quickConnectInterval = null;
        }
        
        quickConnectInterval = setInterval(function() {
            checkQuickConnectStatus();
        }, 3000); // Poll every 3 seconds
        
        // Also check immediately
        checkQuickConnectStatus();
    }

    function checkQuickConnectStatus() {
        if (!quickConnectSecret || !connectedServer) {
            stopQuickConnect();
            return;
        }
        
        JellyfinAPI.checkQuickConnectStatus(connectedServer.address, quickConnectSecret, function(err, response) {
            if (err) {
                JellyfinAPI.Logger.error('Quick Connect status check failed', err);
                return;
            }
            
            if (response.Authenticated) {
                if (elements.quickConnectStatus) {
                    elements.quickConnectStatus.textContent = 'Authenticated! Logging in...';
                    elements.quickConnectStatus.classList.add('authenticated');
                }
                
                // Stop polling but DON'T clear the secret yet - we need it for authentication
                if (quickConnectInterval) {
                    clearInterval(quickConnectInterval);
                    quickConnectInterval = null;
                }
                
                authenticateWithQuickConnect();
            }
        });
    }

    function authenticateWithQuickConnect() {
        if (!quickConnectSecret || !connectedServer) {
            showError('Quick Connect session expired');
            return;
        }
        
        JellyfinAPI.authenticateQuickConnect(connectedServer.address, quickConnectSecret, function(err, authData) {
            // Clear the secret now that we're done with it
            quickConnectSecret = null;
            
            if (err) {
                showError('Quick Connect authentication failed');
                JellyfinAPI.Logger.error('Quick Connect auth failed', err);
                backToUserSelection();
            } else {
                showStatus('Login successful! Welcome, ' + authData.User.Name + '!', 'success');
                JellyfinAPI.Logger.success('Quick Connect login successful', authData);
                
                setTimeout(function() {
                    window.location.href = 'browse.html';
                }, 1000);
            }
        });
    }

    function stopQuickConnect() {
        if (quickConnectInterval) {
            clearInterval(quickConnectInterval);
            quickConnectInterval = null;
        }
        quickConnectSecret = null;
    }

    function showError(message) {
        if (elements.errorMessage) {
            elements.errorMessage.textContent = message;
            elements.errorMessage.style.display = 'block';
        }
    }

    function clearError() {
        if (elements.errorMessage) {
            elements.errorMessage.style.display = 'none';
            elements.errorMessage.textContent = '';
        }
    }

    function showStatus(message, type) {
        if (elements.statusMessage) {
            elements.statusMessage.textContent = message;
            elements.statusMessage.className = 'status-message ' + (type || 'info');
            elements.statusMessage.style.display = 'block';
        }
    }
    
    function clearStatus() {
        if (elements.statusMessage) {
            elements.statusMessage.textContent = '';
            elements.statusMessage.style.display = 'none';
        }
    }

    return {
        init: init
    };
})();

window.addEventListener('load', function() {
    LoginController.init();
});
