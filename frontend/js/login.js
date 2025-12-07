var LoginController = (function() {
    'use strict';

    var currentServers = [];
    var selectedServerIndex = -1;
    var elements = {};

    function init() {
        JellyfinAPI.Logger.info('Initializing login controller...');
        JellyfinAPI.init();
        cacheElements();
        setupEventListeners();
        checkStoredAuth();
        startServerDiscovery();
    }

    function cacheElements() {
        elements = {
            serverUrlInput: document.getElementById('serverUrl'),
            usernameInput: document.getElementById('username'),
            passwordInput: document.getElementById('password'),
            connectBtn: document.getElementById('connectBtn'),
            loginBtn: document.getElementById('loginBtn'),
            discoverBtn: document.getElementById('discoverBtn'),
            serverList: document.getElementById('serverList'),
            loginForm: document.getElementById('loginForm'),
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
        if (elements.loginBtn) {
            elements.loginBtn.addEventListener('click', handleLogin);
        }
        if (elements.discoverBtn) {
            elements.discoverBtn.addEventListener('click', startServerDiscovery);
        }
        
        if (elements.serverUrlInput) {
            elements.serverUrlInput.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) handleConnect();
            });
        }
        if (elements.passwordInput) {
            elements.passwordInput.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) handleLogin();
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
                showStatus('Connected to ' + serverInfo.name + '! Please login.', 'success');
                JellyfinAPI.Logger.success('Server connection verified', serverInfo);
                
                elements.serverUrlInput.value = serverInfo.address;
                
                if (elements.manualServerSection) {
                    elements.manualServerSection.style.display = 'none';
                }
                if (elements.discoveredServersSection) {
                    elements.discoveredServersSection.style.display = 'none';
                }
                
                if (elements.loginForm) {
                    elements.loginForm.style.display = 'block';
                }
                
                if (elements.usernameInput) {
                    elements.usernameInput.focus();
                }
            }
        });
    }

    function handleLogin() {
        var serverUrl = elements.serverUrlInput.value.trim();
        var username = elements.usernameInput.value.trim();
        var password = elements.passwordInput.value;
        
        if (!serverUrl) {
            showError('Please connect to a server first');
            return;
        }
        
        if (!username) {
            showError('Please enter your username');
            elements.usernameInput.focus();
            return;
        }
        
        if (!password) {
            showError('Please enter your password');
            elements.passwordInput.focus();
            return;
        }
        
        showStatus('Logging in as ' + username + '...', 'info');
        clearError();
        
        if (elements.loginBtn) {
            elements.loginBtn.disabled = true;
            elements.loginBtn.textContent = 'Logging in...';
        }
        
        JellyfinAPI.authenticateByName(serverUrl, username, password, function(err, authData) {
            if (elements.loginBtn) {
                elements.loginBtn.disabled = false;
                elements.loginBtn.textContent = 'Login';
            }
            
            if (err) {
                showError('Login failed! Check your username and password.');
                JellyfinAPI.Logger.error('Authentication failed', { username: username, error: err });
            } else {
                showStatus('Login successful! Welcome, ' + authData.username + '!', 'success');
                JellyfinAPI.Logger.success('=== LOGIN SUCCESSFUL ===', {
                    username: authData.username,
                    userId: authData.userId,
                    serverName: authData.serverName,
                    serverAddress: authData.serverAddress,
                    timestamp: new Date().toISOString()
                });
                
                elements.passwordInput.value = '';rnameInput.blur();
                if (elements.passwordInput) elements.passwordInput.blur();
                
                setTimeout(function() {
                    window.location.href = 'browse.html';
                }, 1000);
            }
        });
    }

    function showSuccessScreen(authData) {
        var container = document.querySelector('.container');
        container.innerHTML = '<div class="success-screen">' +
            '<h1>✓ Login Successful!</h1>' +
            '<div class="success-info">' +
            '<p><strong>User:</strong> ' + authData.username + '</p>' +
            '<p><strong>Server:</strong> ' + authData.serverName + '</p>' +
            '<p><strong>Server Address:</strong> ' + authData.serverAddress + '</p>' +
            '</div>' +
            '<p class="success-note">Check the console for detailed login logs.</p>' +
            '<button id="logoutBtn" class="btn btn-secondary">Logout</button>' +
            '</div>';
        
        document.getElementById('logoutBtn').addEventListener('click', function() {
            JellyfinAPI.logout();
            location.reload();
        });
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
