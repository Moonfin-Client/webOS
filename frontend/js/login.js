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
    
    // Timing Constants
    const FOCUS_DELAY_MS = 100;
    const UI_TRANSITION_DELAY_MS = 500;
    const QUICK_CONNECT_POLL_INTERVAL_MS = 3000;
    const LOGIN_SUCCESS_DELAY_MS = 1000;

    function init() {
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
            
            manualLoginBtn: document.getElementById('manualLoginBtn'),
            manualLoginForm: document.getElementById('manualLoginForm'),
            manualUsername: document.getElementById('manualUsername'),
            manualPassword: document.getElementById('manualPassword'),
            manualLoginSubmitBtn: document.getElementById('manualLoginSubmitBtn'),
            cancelManualLoginBtn: document.getElementById('cancelManualLoginBtn'),
            
            backToServerBtn: document.getElementById('backToServerBtn'),
            addAccountBtn: document.getElementById('addAccountBtn'),
            
            manualLoginSection: document.getElementById('manualLoginSection'),
            useManualPasswordBtn: document.getElementById('useManualPasswordBtn'),
            useManualQuickConnectBtn: document.getElementById('useManualQuickConnectBtn'),
            manualPasswordForm: document.getElementById('manualPasswordForm'),
            manualUsername: document.getElementById('manualUsername'),
            manualPassword: document.getElementById('manualPassword'),
            manualLoginBtn: document.getElementById('manualLoginBtn'),
            cancelManualLoginBtn: document.getElementById('cancelManualLoginBtn'),
            manualQuickConnectForm: document.getElementById('manualQuickConnectForm'),
            manualQuickConnectCode: document.getElementById('manualQuickConnectCode'),
            manualQuickConnectStatus: document.getElementById('manualQuickConnectStatus'),
            cancelManualQuickConnectBtn: document.getElementById('cancelManualQuickConnectBtn'),
            
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
        
        // Add Account button
        if (elements.addAccountBtn) {
            elements.addAccountBtn.addEventListener('click', showManualLoginForm);
        }
        if (elements.useManualPasswordBtn) {
            elements.useManualPasswordBtn.addEventListener('click', showManualPasswordForm);
        }
        if (elements.useManualQuickConnectBtn) {
            elements.useManualQuickConnectBtn.addEventListener('click', showManualQuickConnectForm);
        }
        if (elements.manualLoginBtn) {
            elements.manualLoginBtn.addEventListener('click', handleManualLogin);
        }
        if (elements.cancelManualLoginBtn) {
            elements.cancelManualLoginBtn.addEventListener('click', cancelManualLogin);
        }
        if (elements.cancelManualQuickConnectBtn) {
            elements.cancelManualQuickConnectBtn.addEventListener('click', cancelManualLogin);
        }
        if (elements.manualPassword) {
            elements.manualPassword.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) handleManualLogin();
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
        if (elements.manualLoginBtn) {
            elements.manualLoginBtn.addEventListener('click', showManualLoginForm);
        }
        if (elements.manualLoginSubmitBtn) {
            elements.manualLoginSubmitBtn.addEventListener('click', handleManualLogin);
        }
        if (elements.cancelManualLoginBtn) {
            elements.cancelManualLoginBtn.addEventListener('click', backToUserSelection);
        }
        if (elements.manualUsername) {
            elements.manualUsername.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) {
                    e.preventDefault();
                    elements.manualPassword.focus();
                }
            });
        }
        if (elements.manualPassword) {
            elements.manualPassword.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) handleManualLogin();
            });
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
            }, UI_TRANSITION_DELAY_MS);
            return true;
        }
        
        // Check for auto-login setting
        var settings = storage.get('jellyfin_settings');
        if (settings && settings.autoLogin) {
            var lastLogin = storage.get('last_login');
            if (lastLogin && lastLogin.serverAddress && lastLogin.username) {
                attemptAutoLogin(lastLogin);
                return true;
            }
        }
        
        return false;
    }
    
    function attemptAutoLogin(lastLogin) {
        showStatus('Auto-login: connecting to ' + (lastLogin.serverName || 'server') + '...', 'info');
        
        // Connect to server first
        JellyfinAPI.getPublicSystemInfo(lastLogin.serverAddress, function(err, systemInfo) {
            if (err) {
                showError('Auto-login failed: cannot connect to server');
                clearAutoLoginData();
                setTimeout(function() {
                    checkLastServer();
                }, 1000);
                return;
            }
            
            connectedServer = {
                address: lastLogin.serverAddress,
                name: systemInfo.ServerName || lastLogin.serverName,
                id: systemInfo.Id
            };
            
            // Get public users to find the user
            JellyfinAPI.getPublicUsers(lastLogin.serverAddress, function(err, users) {
                if (err || !users || users.length === 0) {
                    showError('Auto-login failed: cannot get users');
                    clearAutoLoginData();
                    setTimeout(function() {
                        checkLastServer();
                    }, 1000);
                    return;
                }
                
                // Find the user
                var user = users.find(function(u) {
                    return u.Name === lastLogin.username;
                });
                
                if (!user) {
                    showError('Auto-login failed: user not found');
                    clearAutoLoginData();
                    setTimeout(function() {
                        checkLastServer();
                    }, 1000);
                    return;
                }
                
                selectedUser = user;
                
                // Attempt login with empty password (for passwordless users)
                showStatus('Auto-login: logging in as ' + user.Name + '...', 'info');
                
                JellyfinAPI.authenticateByName(lastLogin.serverAddress, user.Name, '', function(err, authData) {
                    if (err || !authData || !authData.AccessToken) {
                        // Auto-login failed, show normal login
                        showError('Auto-login failed: password required. Please login manually.');
                        clearAutoLoginData();
                        setTimeout(function() {
                            // Show user selection for manual login
                            connectedServer = {
                                address: lastLogin.serverAddress,
                                name: systemInfo.ServerName || lastLogin.serverName,
                                id: systemInfo.Id
                            };
                            publicUsers = users;
                            showUserSelection();
                        }, 1500);
                        return;
                    }
                    
                    showStatus('Auto-login successful! Welcome, ' + authData.User.Name + '!', 'success');
                    
                    setTimeout(function() {
                        window.location.href = 'browse.html';
                    }, LOGIN_SUCCESS_DELAY_MS);
                });
            });
        });
    }
    
    function clearAutoLoginData() {
        // Clear auto-login data if it fails
        storage.remove('last_login');
    }

    function checkLastServer() {
        // Check if there's a stored server connection (for returning from logout)
        var lastServer = storage.get('last_server', true);
        
        if (lastServer && lastServer.address) {
            
            // Set the server URL
            if (elements.serverUrlInput) {
                elements.serverUrlInput.value = lastServer.address;
            }
            
            // Automatically connect and show user selection
            setTimeout(function() {
                handleConnect();
            }, FOCUS_DELAY_MS);
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
                elements.connectBtn.textContent = 'Connect';
            }
            
            if (err) {
                showError('Unable to connect to server. Check the address and try again.');
            } else {
                showStatus('Connected to ' + serverInfo.name + '! Loading users...', 'success');
                
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
                return;
            }
            
            if (!users || users.length === 0) {
                publicUsers = [];
                // Show toaster message
                showStatus('No public users found. Use "Add Account" to login manually.', 'info');
                // Auto-hide after 4 seconds
                setTimeout(function() {
                    clearStatus();
                }, 4000);
            } else {
                publicUsers = users;
            }
            
            // Hide server selection
            if (elements.manualServerSection) {
                elements.manualServerSection.style.display = 'none';
            }
            if (elements.discoveredServersSection) {
                elements.discoveredServersSection.style.display = 'none';
            }
            
            // Show user selection (even if empty)
            renderUserRow(publicUsers);
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
            // Leave empty and focus Add Account button
            if (elements.addAccountBtn) {
                setTimeout(function() {
                    elements.addAccountBtn.focus();
                }, FOCUS_DELAY_MS);
            }
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
            }, FOCUS_DELAY_MS);
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

    function showManualLoginForm() {
        if (!connectedServer) {
            showError('No server connected');
            return;
        }
        
        // Hide user selection
        if (elements.userSelection) {
            elements.userSelection.style.display = 'none';
        }
        
        // Show manual login section
        if (elements.manualLoginSection) {
            elements.manualLoginSection.style.display = 'block';
        }
        
        // Show both login method buttons
        if (elements.useManualPasswordBtn) {
            elements.useManualPasswordBtn.style.display = 'inline-block';
        }
        if (elements.useManualQuickConnectBtn) {
            elements.useManualQuickConnectBtn.style.display = 'inline-block';
        }
        
        // Show password form by default
        showManualPasswordForm();
        
        clearError();
        clearStatus();
    }
    
    function showManualPasswordForm() {
        // Hide Quick Connect form
        if (elements.manualQuickConnectForm) {
            elements.manualQuickConnectForm.style.display = 'none';
        }
        
        // Show password form
        if (elements.manualPasswordForm) {
            elements.manualPasswordForm.style.display = 'block';
        }
        
        // Hide Use Password button, show Use Quick Connect button
        if (elements.useManualPasswordBtn) {
            elements.useManualPasswordBtn.style.display = 'none';
        }
        if (elements.useManualQuickConnectBtn) {
            elements.useManualQuickConnectBtn.style.display = 'inline-block';
        }
        
        // Clear and focus username
        if (elements.manualUsername) {
            elements.manualUsername.value = '';
            elements.manualUsername.focus();
        }
        if (elements.manualPassword) {
            elements.manualPassword.value = '';
        }
        
        clearError();
    }
    
    function showManualQuickConnectForm() {
        // Hide password form
        if (elements.manualPasswordForm) {
            elements.manualPasswordForm.style.display = 'none';
        }
        
        // Show Quick Connect form
        if (elements.manualQuickConnectForm) {
            elements.manualQuickConnectForm.style.display = 'block';
        }
        
        // Hide Use Quick Connect button, show Use Password button
        if (elements.useManualQuickConnectBtn) {
            elements.useManualQuickConnectBtn.style.display = 'none';
        }
        if (elements.useManualPasswordBtn) {
            elements.useManualPasswordBtn.style.display = 'inline-block';
        }
        
        // Quick Connect doesn't need username - initiate directly
        initiateManualQuickConnect();
        
        clearError();
    }
    
    /**
     * Initiate Quick Connect flow (shared logic for manual and regular login)
     * @param {Object} config - Configuration object
     * @param {HTMLElement} config.codeElement - Element to display QC code
     * @param {HTMLElement} config.statusElement - Element to display status
     * @param {Function} config.onSuccess - Callback on successful authentication
     * @param {Function} config.onError - Callback on error
     */
    function initiateQuickConnectFlow(config) {
        if (!connectedServer) {
            showError('No server connected');
            return;
        }
        
        showStatus('Initiating Quick Connect...', 'info');
        
        JellyfinAPI.initiateQuickConnect(connectedServer.address, function(err, data) {
            if (err || !data || !data.Secret) {
                clearStatus();
                showError('Quick Connect is not available');
                if (config.onError) config.onError();
                return;
            }
            
            quickConnectSecret = data.Secret;
            
            if (config.codeElement) {
                config.codeElement.textContent = data.Code || '------';
            }
            if (config.statusElement) {
                config.statusElement.textContent = 'Waiting for authentication...';
                if (config.statusElement.classList) {
                    config.statusElement.classList.remove('authenticated');
                }
            }
            
            clearStatus();
            
            // Start polling for Quick Connect completion
            if (quickConnectInterval) {
                clearInterval(quickConnectInterval);
            }
            quickConnectInterval = setInterval(function() {
                pollQuickConnectStatus(config);
            }, QUICK_CONNECT_POLL_INTERVAL_MS);
            
            // Check immediately
            if (config.checkImmediately) {
                pollQuickConnectStatus(config);
            }
        });
    }
    
    /**
     * Poll Quick Connect status (shared logic for manual and regular login)
     * @param {Object} config - Configuration object (same as initiateQuickConnectFlow)
     */
    function pollQuickConnectStatus(config) {
        if (!quickConnectSecret || !connectedServer) {
            stopQuickConnectPolling();
            return;
        }
        
        // First check the status
        JellyfinAPI.checkQuickConnectStatus(connectedServer.address, quickConnectSecret, function(err, statusData) {
            if (err) {
                return; // Keep polling
            }
            
            if (!statusData) {
                // Still waiting
                return;
            }
            
            // Check if authenticated
            if (statusData.Authenticated !== true) {
                // Still waiting for user to approve
                return;
            }
            
            // User has approved! Now exchange the secret for access token
            JellyfinAPI.authenticateQuickConnect(connectedServer.address, quickConnectSecret, function(authErr, authData) {
                if (authErr) {
                    stopQuickConnectPolling();
                    showError('Quick Connect authentication failed: ' + (authErr.error || 'Unknown error'));
                    if (config.onError) config.onError();
                    return;
                }
                
                if (!authData || !authData.AccessToken || !authData.User) {
                    stopQuickConnectPolling();
                    showError('Quick Connect authentication response invalid');
                    if (config.onError) config.onError();
                    return;
                }
                
                stopQuickConnectPolling();
                
                // Update status if element provided
                if (config.statusElement) {
                    config.statusElement.textContent = 'Authenticated! Logging in...';
                    if (config.statusElement.classList) {
                        config.statusElement.classList.add('authenticated');
                    }
                }
                
                // Note: Auth is already stored by authenticateQuickConnect in jellyfin-api.js
                
                // Store server info for last login
                storage.set('jellyfin_last_server', {
                    address: connectedServer.address,
                    name: connectedServer.name,
                    username: authData.User.Name
                });
                
                // Save for auto-login
                storage.set('last_login', {
                    serverAddress: connectedServer.address,
                    serverName: connectedServer.name,
                    username: authData.User.Name,
                    isQuickConnect: true
                });
                
                showStatus('Login successful! Welcome, ' + authData.User.Name + '!', 'success');
                
                if (config.onSuccess) {
                    config.onSuccess(authData);
                } else {
                    setTimeout(function() {
                        window.location.href = 'browse.html';
                    }, LOGIN_SUCCESS_DELAY_MS);
                }
            });
        });
    }
    
    /**
     * Stop Quick Connect polling
     */
    function stopQuickConnectPolling() {
        if (quickConnectInterval) {
            clearInterval(quickConnectInterval);
            quickConnectInterval = null;
        }
        quickConnectSecret = null;
    }
    
    function initiateManualQuickConnect() {
        initiateQuickConnectFlow({
            codeElement: elements.manualQuickConnectCode,
            statusElement: elements.manualQuickConnectStatus,
            onError: null
        });
    }
    
    function cancelManualLogin() {
        // Stop Quick Connect polling if active
        stopQuickConnectPolling();
        
        // Hide manual login section
        if (elements.manualLoginSection) {
            elements.manualLoginSection.style.display = 'none';
        }
        if (elements.manualPasswordForm) {
            elements.manualPasswordForm.style.display = 'none';
        }
        if (elements.manualQuickConnectForm) {
            elements.manualQuickConnectForm.style.display = 'none';
        }
        
        // Show user selection
        if (elements.userSelection) {
            elements.userSelection.style.display = 'block';
        }
        
        // Focus Add Account button
        if (elements.addAccountBtn) {
            setTimeout(function() {
                elements.addAccountBtn.focus();
            }, FOCUS_DELAY_MS);
        }
        
        clearError();
    }
    
    function handleManualLogin() {
        if (!connectedServer) {
            showError('No server connected');
            return;
        }
        
        var username = elements.manualUsername ? elements.manualUsername.value.trim() : '';
        var password = elements.manualPassword ? elements.manualPassword.value : '';
        
        if (!username) {
            showError('Please enter a username');
            if (elements.manualUsername) {
                elements.manualUsername.focus();
            }
            return;
        }
        
        clearError();
        showStatus('Logging in as ' + username + '...', 'info');
        
        JellyfinAPI.authenticateByName(
            connectedServer.address,
            username,
            password,
            function(err, authData) {
                if (err || !authData) {
                    showError('Login failed! Check your username and password.');
                    return;
                }
                
                if (!authData.accessToken || !authData.userId) {
                    showError('Login failed! Invalid response from server.');
                    return;
                }
                
                // Note: authData from authenticateByName already stores auth, no need to call storeAuth again
                
                // Store server info for last login
                storage.set('jellyfin_last_server', {
                    address: connectedServer.address,
                    name: connectedServer.name,
                    username: authData.username
                });
                
                showStatus('Login successful! Welcome, ' + authData.username + '!', 'success');
                
                setTimeout(function() {
                    window.location.href = 'browse.html';
                }, LOGIN_SUCCESS_DELAY_MS);
            }
        );
    }

    function showPasswordForm() {
        hideAllLoginMethods();
        
        if (elements.passwordForm) {
            elements.passwordForm.style.display = 'block';
        }
        
        // Hide Use Password button, show Use Quick Connect button
        if (elements.usePasswordBtn) {
            elements.usePasswordBtn.style.display = 'none';
        }
        if (elements.useQuickConnectBtn) {
            elements.useQuickConnectBtn.style.display = 'inline-block';
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
        
        // Hide Use Quick Connect button, show Use Password button
        if (elements.useQuickConnectBtn) {
            elements.useQuickConnectBtn.style.display = 'none';
        }
        if (elements.usePasswordBtn) {
            elements.usePasswordBtn.style.display = 'inline-block';
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
        if (elements.manualLoginForm) {
            elements.manualLoginForm.style.display = 'none';
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
                // Don't set src attribute when there's no image - this prevents broken image placeholder
                avatarElement.removeAttribute('src');
                avatarElement.classList.add('no-image');
            }
        }
    }

    function backToUserSelection() {
        stopQuickConnect();
        
        if (elements.loginForm) {
            elements.loginForm.style.display = 'none';
        }
        if (elements.manualLoginForm) {
            elements.manualLoginForm.style.display = 'none';
        }
        if (elements.userSelection) {
            elements.userSelection.style.display = 'block';
        }
        
        selectedUser = null;
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
        if (elements.manualLoginForm) {
            elements.manualLoginForm.style.display = 'none';
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
                return;
            }
            
            if (!authData || !authData.accessToken) {
                    hasAuthData: !!authData,
                    hasUsername: !!(authData && authData.username),
                    hasAccessToken: !!(authData && authData.accessToken)
                });
                showError('Login failed! Invalid response from server.');
                return;
            }
            
            showStatus('Login successful! Welcome, ' + authData.username + '!', 'success');
            
            // Save login info for auto-login (only for passwordless users)
            if (!password || password === '') {
                storage.set('last_login', {
                    serverAddress: connectedServer.address,
                    serverName: connectedServer.name,
                    username: selectedUser.Name
                });
            }
            
            elements.passwordInput.value = '';
            
            setTimeout(function() {
                window.location.href = 'browse.html';
            }, 1000);
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
        
        initiateQuickConnectFlow({
            codeElement: elements.quickConnectCode,
            statusElement: elements.quickConnectStatus,
            checkImmediately: true,
            onError: backToUserSelection
        });
    }

    function stopQuickConnect() {
        stopQuickConnectPolling();
    }

    function showManualLoginForm() {
        
        if (!connectedServer) {
            showError('No server connected');
            return;
        }
        
        // Hide user selection
        if (elements.userSelection) {
            elements.userSelection.style.display = 'none';
        }
        
        // Show manual login form
        if (elements.manualLoginForm) {
            elements.manualLoginForm.style.display = 'block';
        }
        
        // Clear previous inputs
        if (elements.manualUsername) {
            elements.manualUsername.value = '';
        }
        if (elements.manualPassword) {
            elements.manualPassword.value = '';
        }
        
        clearError();
        
        // Focus username field
        setTimeout(function() {
            if (elements.manualUsername) {
                elements.manualUsername.focus();
            }
        }, FOCUS_DELAY_MS);
    }

    function handleManualLogin() {
        var username = elements.manualUsername ? elements.manualUsername.value.trim() : '';
        var password = elements.manualPassword ? elements.manualPassword.value : '';
        
        if (!username) {
            showError('Please enter a username');
            if (elements.manualUsername) {
                elements.manualUsername.focus();
            }
            return;
        }
        
        if (!connectedServer) {
            showError('No server connected');
            return;
        }
        
        showStatus('Logging in as ' + username + '...', 'info');
        clearError();
        
        // Disable submit button
        if (elements.manualLoginSubmitBtn) {
            elements.manualLoginSubmitBtn.disabled = true;
            elements.manualLoginSubmitBtn.textContent = 'Logging in...';
        }
        
        JellyfinAPI.authenticateByName(
            connectedServer.address,
            username,
            password,
            function(err, authData) {
                // Re-enable button
                if (elements.manualLoginSubmitBtn) {
                    elements.manualLoginSubmitBtn.disabled = false;
                    elements.manualLoginSubmitBtn.textContent = 'Login';
                }
                
                if (err) {
                    
                    if (err.error === 401) {
                        showError('Invalid username or password');
                    } else if (err.error === 'timeout') {
                        showError('Connection timeout. Please try again.');
                    } else {
                        showError('Login failed. Please try again.');
                    }
                    
                    if (elements.manualPassword) {
                        elements.manualPassword.value = '';
                        elements.manualPassword.focus();
                    }
                    return;
                }
                
                if (!authData || !authData.accessToken) {
                    showError('Login failed - no access token received');
                    return;
                }
                
                showStatus('Login successful! Welcome, ' + authData.username + '!', 'success');
                
                setTimeout(function() {
                    window.location.href = 'browse.html';
                }, LOGIN_SUCCESS_DELAY_MS);
            }
        );
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
