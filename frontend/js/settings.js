/*
 * Settings Controller
 * Handles settings navigation and configuration
 */

var SettingsController = (function() {
    'use strict';

    var auth = null;
    
    var focusManager = {
        inSidebar: true,
        inNavBar: false,
        navBarIndex: 0, 
        sidebarIndex: 0,
        contentIndex: 0,
        currentCategory: 'general',
        inSliderMode: false,
        sliderSetting: null
    };

    var elements = {};
    
    // Timing Constants
    const FOCUS_DELAY_MS = 100;

    var settings = {
        autoLogin: false,
        clockDisplay: '12-hour',
        skipIntro: true,
        autoPlay: true,
        theme: 'dark',
        carouselSpeed: 8000,
        homeRows: null, // Will be initialized with defaults
        showShuffleButton: true,
        showGenresButton: true,
        showFavoritesButton: true,
        showLibrariesInToolbar: true,
        showFeaturedBanner: true,
        // Image Helper settings
        imageType: 'Primary',
        posterSize: 300, // X-Large (always highest quality)
        preferParentThumb: false,
        // Continue Watching settings
        mergeContinueWatchingNextUp: false,
        // Backdrop blur settings
        backdropBlurHome: 3,
        backdropBlurDetail: 3
    };

    // Default home rows configuration
    var defaultHomeRows = [
        { id: 'resume', name: 'Continue Watching', enabled: true, order: 0 },
        { id: 'nextup', name: 'Next Up', enabled: true, order: 1 },
        { id: 'livetv', name: 'Live TV', enabled: true, order: 2 },
        { id: 'library-tiles', name: 'My Media', enabled: false, order: 3 },
        { id: 'latest-movies', name: 'Latest Movies', enabled: true, order: 4 },
        { id: 'latest-shows', name: 'Latest TV Shows', enabled: true, order: 5 },
        { id: 'latest-music', name: 'Latest Music', enabled: true, order: 6 },
        { id: 'collections', name: 'Collections', enabled: false, order: 7 }
    ];

    var homeRowsModal = {
        isOpen: false,
        focusedIndex: 0,
        rows: [],
        // Store references to event handlers for cleanup
        saveHandler: null,
        cancelHandler: null,
        resetHandler: null
    };

    /**
     * Initialize the settings controller
     * Loads settings, displays user info, and sets up navigation
     */
    function init() {
        auth = JellyfinAPI.getStoredAuth();
        if (!auth) {
            window.location.href = 'login.html';
            return;
        }

        cacheElements();
        loadSettings();
        displayUserInfo();
        attachEventListeners();
        updateSettingValues();
        
        focusToSidebar();
    }

    /**
     * Cache frequently accessed DOM elements for better performance
     * @private
     */
    function cacheElements() {
        elements = {
            username: document.getElementById('username'),
            userAvatar: document.getElementById('userAvatar'),
            homeBtn: document.getElementById('homeBtn'),
            moviesBtn: document.getElementById('moviesBtn'),
            showsBtn: document.getElementById('showsBtn'),
            searchBtn: document.getElementById('searchBtn'),
            settingsBtn: document.getElementById('settingsBtn'),
            settingsSidebar: document.getElementById('settingsSidebar'),
            settingsContent: document.getElementById('settingsContent')
        };
    }

    /**
     * Display current user information in the UI
     * @private
     */
    function displayUserInfo() {
        if (elements.username) {
            elements.username.textContent = auth.username;
        }
        if (elements.userAvatar && auth.username) {
            elements.userAvatar.textContent = auth.username.charAt(0).toUpperCase();
        }
        
        var usernameValue = document.getElementById('usernameValue');
        if (usernameValue) {
            usernameValue.textContent = auth.username;
        }
        
        var serverValue = document.getElementById('serverValue');
        if (serverValue) {
            serverValue.textContent = auth.serverAddress;
        }
        
        // Fetch and display server version
        var serverVersionValue = document.getElementById('serverVersionValue');
        if (serverVersionValue && auth.serverAddress && auth.accessToken) {
            JellyfinAPI.getSystemInfo(auth.serverAddress, auth.accessToken, function(err, data) {
                if (!err && data && data.Version) {
                    serverVersionValue.textContent = data.Version;
                } else {
                    serverVersionValue.textContent = 'Unknown';
                }
            });
        }
    }

    /**
     * Apply default values for any missing settings
     * @private
     * @param {Object} loadedSettings - Settings object to populate with defaults
     * @returns {boolean} True if settings were modified
     */
    function applyDefaultSettings(loadedSettings) {
        var modified = false;
        
        // Ensure homeRows exists
        if (!loadedSettings.homeRows) {
            loadedSettings.homeRows = JSON.parse(JSON.stringify(defaultHomeRows));
            modified = true;
        }
        
        // Apply defaults for all settings
        var defaults = {
            autoLogin: false,
            clockDisplay: '12-hour',
            skipIntro: true,
            autoPlay: true,
            theme: 'dark',
            carouselSpeed: 8000,
            showShuffleButton: true,
            showGenresButton: true,
            showFavoritesButton: true,
            showLibrariesInToolbar: true,
            showFeaturedBanner: true,
            imageType: 'Primary',
            posterSize: 300,
            preferParentThumb: false,
            mergeContinueWatchingNextUp: false,
            backdropBlurHome: 3,
            backdropBlurDetail: 3
        };
        
        for (var key in defaults) {
            if (typeof loadedSettings[key] === 'undefined') {
                loadedSettings[key] = defaults[key];
                modified = true;
            }
        }
        
        return modified;
    }

    /**
     * Load settings from persistent storage
     * @private
     */
    function loadSettings() {
        var stored = storage.get('jellyfin_settings');
        if (stored) {
            try {
                settings = JSON.parse(stored);
                
                // Apply defaults for any missing settings and save if modified
                if (applyDefaultSettings(settings)) {
                    saveSettings();
                }
            } catch (e) {
                JellyfinAPI.Logger.error('Failed to parse settings:', e);
                settings.homeRows = JSON.parse(JSON.stringify(defaultHomeRows));
            }
        } else {
            settings.homeRows = JSON.parse(JSON.stringify(defaultHomeRows));
            saveSettings();
        }
        
        // Initialize ImageHelper with settings
        if (typeof ImageHelper !== 'undefined') {
            syncImageHelperSettings();
        }
    }

    /**
     * Save current settings to persistent storage
     * @private
     */
    function saveSettings() {
        storage.set('jellyfin_settings', JSON.stringify(settings));
    }

    /**
     * Update all setting value displays in the UI
     * @private
     */
    function updateSettingValues() {
        var autoLoginValue = document.getElementById('autoLoginValue');
        if (autoLoginValue) {
            autoLoginValue.textContent = settings.autoLogin ? 'On' : 'Off';
        }
        
        var clockDisplayValue = document.getElementById('clockDisplayValue');
        if (clockDisplayValue) {
            clockDisplayValue.textContent = settings.clockDisplay === '12-hour' ? '12-Hour' : '24-Hour';
        }
        
        var maxBitrateValue = document.getElementById('maxBitrateValue');
        if (maxBitrateValue) {
            maxBitrateValue.textContent = settings.maxBitrate === 'auto' ? 'Auto' : settings.maxBitrate + ' Mbps';
        }
        
        var skipIntroValue = document.getElementById('skipIntroValue');
        if (skipIntroValue) {
            skipIntroValue.textContent = settings.skipIntro ? 'On' : 'Off';
        }
        
        var autoPlayValue = document.getElementById('autoPlayValue');
        if (autoPlayValue) {
            autoPlayValue.textContent = settings.autoPlay ? 'On' : 'Off';
        }
        
        var audioLanguageValue = document.getElementById('audioLanguageValue');
        if (audioLanguageValue) {
            audioLanguageValue.textContent = 'English'; // Simplified
        }
        
        var subtitleLanguageValue = document.getElementById('subtitleLanguageValue');
        if (subtitleLanguageValue) {
            subtitleLanguageValue.textContent = settings.subtitleLanguage === 'none' ? 'None' : settings.subtitleLanguage;
        }
        
        var themeValue = document.getElementById('themeValue');
        if (themeValue) {
            themeValue.textContent = settings.theme === 'dark' ? 'Dark' : 'Light';
        }
        
        var carouselSpeedValue = document.getElementById('carouselSpeedValue');
        if (carouselSpeedValue) {
            carouselSpeedValue.textContent = (settings.carouselSpeed / 1000) + ' seconds';
        }
        
        // Image Helper settings
        var imageTypeValue = document.getElementById('imageTypeValue');
        if (imageTypeValue) {
            var imageTypeText = settings.imageType === 'Primary' ? 'Poster' : 
                                settings.imageType === 'Thumb' ? 'Thumbnail' : 'Banner';
            imageTypeValue.textContent = imageTypeText;
        }
        
        var preferParentThumbValue = document.getElementById('preferParentThumbValue');
        if (preferParentThumbValue) {
            preferParentThumbValue.textContent = settings.preferParentThumb ? 'On' : 'Off';
        }
        
        var mergeContinueWatchingValue = document.getElementById('merge-continue-watching-value');
        if (mergeContinueWatchingValue) {
            mergeContinueWatchingValue.textContent = settings.mergeContinueWatchingNextUp ? 'On' : 'Off';
        }
        
        // Moonfin settings
        var showShuffleButtonValue = document.getElementById('showShuffleButtonValue');
        if (showShuffleButtonValue) {
            showShuffleButtonValue.textContent = settings.showShuffleButton ? 'On' : 'Off';
        }
        
        var showGenresButtonValue = document.getElementById('showGenresButtonValue');
        if (showGenresButtonValue) {
            showGenresButtonValue.textContent = settings.showGenresButton ? 'On' : 'Off';
        }
        
        var showFavoritesButtonValue = document.getElementById('showFavoritesButtonValue');
        if (showFavoritesButtonValue) {
            showFavoritesButtonValue.textContent = settings.showFavoritesButton ? 'On' : 'Off';
        }
        
        var showLibrariesInToolbarValue = document.getElementById('showLibrariesInToolbarValue');
        if (showLibrariesInToolbarValue) {
            showLibrariesInToolbarValue.textContent = settings.showLibrariesInToolbar ? 'On' : 'Off';
        }
        
        var showFeaturedBannerValue = document.getElementById('show-featured-banner-value');
        if (showFeaturedBannerValue) {
            showFeaturedBannerValue.textContent = settings.showFeaturedBanner ? 'On' : 'Off';
        }
        
        // Backdrop blur settings
        var backdropBlurHomeValue = document.getElementById('backdrop-blur-home-value');
        if (backdropBlurHomeValue) {
            backdropBlurHomeValue.textContent = settings.backdropBlurHome !== undefined ? settings.backdropBlurHome : 3;
        }
        
        var backdropBlurDetailValue = document.getElementById('backdrop-blur-detail-value');
        if (backdropBlurDetailValue) {
            backdropBlurDetailValue.textContent = settings.backdropBlurDetail !== undefined ? settings.backdropBlurDetail : 3;
        }
    }

    function attachEventListeners() {
        document.addEventListener('keydown', handleKeyDown);
        
        if (elements.homeBtn) {
            elements.homeBtn.addEventListener('click', function() {
                window.location.href = 'browse.html';
            });
        }
        
        var categories = document.querySelectorAll('.settings-category');
        categories.forEach(function(cat, index) {
            cat.addEventListener('click', function() {
                selectCategory(index);
            });
        });
        
        var settingItems = document.querySelectorAll('.setting-item:not(.non-interactive)');
        settingItems.forEach(function(item) {
            item.addEventListener('click', function() {
                handleSettingActivation(item);
            });
        });
    }

    function handleKeyDown(evt) {
        evt = evt || window.event;
        
        // Check if modal is open
        if (homeRowsModal.isOpen) {
            handleHomeRowsModalNavigation(evt);
            return;
        }
        
        if (evt.keyCode === KeyCodes.BACK) {
            evt.preventDefault();
            window.location.href = 'browse.html';
            return;
        }
        
        if (focusManager.inNavBar) {
            handleNavBarNavigation(evt);
        } else if (focusManager.inSidebar) {
            handleSidebarNavigation(evt);
        } else {
            handleContentNavigation(evt);
        }
    }

    /**
     * Get all navbar button elements
     * @returns {HTMLElement[]} Array of navbar button elements
     * @private
     */
    function getNavButtons() {
        return Array.from(document.querySelectorAll('.nav-left .nav-btn, .nav-center .nav-btn'));
    }

    /**
     * Get all settings category elements
     * @returns {NodeList} NodeList of category elements
     * @private
     */
    function getCategories() {
        return document.querySelectorAll('.settings-category');
    }

    /**
     * Get all settings category elements as array
     * @returns {HTMLElement[]} Array of category elements
     * @private
     */
    function getCategoriesArray() {
        return Array.from(getCategories());
    }

    /**
     * Handle keyboard navigation within navbar
     * @param {KeyboardEvent} evt - Keyboard event
     * @private
     */
    function handleNavBarNavigation(evt) {
        var navButtons = getNavButtons();
        
        navButtons.forEach(function(btn) {
            btn.classList.remove('focused');
        });
        
        switch (evt.keyCode) {
            case KeyCodes.LEFT: // Left
                evt.preventDefault();
                if (focusManager.navBarIndex > 0) {
                    focusManager.navBarIndex--;
                }
                navButtons[focusManager.navBarIndex].classList.add('focused');
                navButtons[focusManager.navBarIndex].focus();
                break;
                
            case KeyCodes.RIGHT: // Right
                evt.preventDefault();
                if (focusManager.navBarIndex < navButtons.length - 1) {
                    focusManager.navBarIndex++;
                }
                navButtons[focusManager.navBarIndex].classList.add('focused');
                navButtons[focusManager.navBarIndex].focus();
                break;
                
            case KeyCodes.DOWN: // Down
                evt.preventDefault();
                focusToSidebar();
                break;
                
            case KeyCodes.ENTER: // Enter
                evt.preventDefault();
                var currentBtn = navButtons[focusManager.navBarIndex];
                if (currentBtn) {
                    currentBtn.click();
                }
                break;
        }
    }

    /**
     * Handle keyboard navigation within settings sidebar
     * @param {KeyboardEvent} evt - Keyboard event
     * @private
     */
    function handleSidebarNavigation(evt) {
        var categories = getCategoriesArray();
        
        switch (evt.keyCode) {
            case KeyCodes.UP: // Up
                evt.preventDefault();
                if (focusManager.sidebarIndex > 0) {
                    focusManager.sidebarIndex--;
                    selectCategory(focusManager.sidebarIndex);
                } else {
                    focusToNavBar();
                }
                break;
                
            case KeyCodes.DOWN: // Down
                evt.preventDefault();
                if (focusManager.sidebarIndex < categories.length - 1) {
                    focusManager.sidebarIndex++;
                    selectCategory(focusManager.sidebarIndex);
                }
                break;
                
            case KeyCodes.RIGHT: // Right
                evt.preventDefault();
                focusToContent();
                break;
                
            case KeyCodes.ENTER: // Enter
                evt.preventDefault();
                selectCategory(focusManager.sidebarIndex);
                focusToContent();
                break;
        }
    }

    /**
     * Handle keyboard navigation within settings content area
     * @param {KeyboardEvent} evt - Keyboard event
     * @private
     */
    function handleContentNavigation(evt) {
        // If in slider mode, handle slider navigation
        if (focusManager.inSliderMode) {
            handleSliderNavigation(evt);
            return;
        }
        
        var panel = document.querySelector('.settings-panel.active');
        if (!panel) return;
        
        var items = Array.from(panel.querySelectorAll('.setting-item:not(.non-interactive)'));
        if (items.length === 0) return;
        
        switch (evt.keyCode) {
            case KeyCodes.UP: // Up
                evt.preventDefault();
                if (focusManager.contentIndex > 0) {
                    focusManager.contentIndex--;
                    updateContentFocus(items);
                }
                break;
                
            case KeyCodes.DOWN: // Down
                evt.preventDefault();
                if (focusManager.contentIndex < items.length - 1) {
                    focusManager.contentIndex++;
                    updateContentFocus(items);
                }
                break;
                
            case KeyCodes.LEFT: // Left
                evt.preventDefault();
                focusToSidebar();
                break;
                
            case KeyCodes.ENTER: // Enter
                evt.preventDefault();
                handleSettingActivation(items[focusManager.contentIndex]);
                break;
        }
    }

    function focusToNavBar() {
        focusManager.inNavBar = true;
        focusManager.inSidebar = false;
        
        var navButtons = getNavButtons();
        navButtons.forEach(function(btn) {
            btn.classList.remove('focused');
        });
        
        // Start at home button (index 1), not user avatar (index 0)
        if (focusManager.navBarIndex === 0 || focusManager.navBarIndex >= navButtons.length) {
            focusManager.navBarIndex = navButtons.length > 1 ? 1 : 0;
        }
        
        if (navButtons[focusManager.navBarIndex]) {
            navButtons[focusManager.navBarIndex].classList.add('focused');
            navButtons[focusManager.navBarIndex].focus();
        }
        
        var categories = getCategories();
        categories.forEach(function(cat) {
            cat.classList.remove('focused');
        });
        
        var items = document.querySelectorAll('.setting-item');
        items.forEach(function(item) {
            item.classList.remove('focused');
        });
    }

    function focusToSidebar() {
        focusManager.inSidebar = true;
        focusManager.inNavBar = false;
        updateSidebarFocus();
        
        var navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(function(btn) {
            btn.classList.remove('focused');
        });
        
        var items = document.querySelectorAll('.setting-item');
        items.forEach(function(item) {
            item.classList.remove('focused');
        });
    }

    function focusToContent() {
        focusManager.inSidebar = false;
        focusManager.inNavBar = false;
        focusManager.contentIndex = 0;
        
        var panel = document.querySelector('.settings-panel.active');
        if (!panel) return;
        
        var items = Array.from(panel.querySelectorAll('.setting-item:not(.non-interactive)'));
        updateContentFocus(items);
        
        var categories = getCategories();
        categories.forEach(function(cat) {
            cat.classList.remove('focused');
        });
    }

    function updateSidebarFocus() {
        var categories = getCategories();
        categories.forEach(function(cat, index) {
            if (index === focusManager.sidebarIndex) {
                cat.classList.add('focused');
                cat.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                cat.classList.remove('focused');
            }
        });
    }

    function updateContentFocus(items) {
        items.forEach(function(item, index) {
            if (index === focusManager.contentIndex) {
                item.classList.add('focused');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                item.classList.remove('focused');
            }
        });
    }

    /**
     * Select and display a settings category
     * @param {number} index - Index of category to select
     * @private
     */
    function selectCategory(index) {
        focusManager.sidebarIndex = index;
        focusManager.contentIndex = 0;
        
        var categories = getCategoriesArray();
        var category = categories[index];
        if (!category) return;
        
        var categoryName = category.dataset.category;
        focusManager.currentCategory = categoryName;
        
        var panels = document.querySelectorAll('.settings-panel');
        panels.forEach(function(panel) {
            panel.classList.remove('active');
        });
        
        var panel = document.getElementById(categoryName + 'Panel');
        if (panel) {
            panel.classList.add('active');
        }
        
        updateSidebarFocus();
    }

    /**
     * Handle activation of a setting item
     * @param {HTMLElement} item - Setting item element
     * @private
     */
    function handleSettingActivation(item) {
        var settingName = item.dataset.setting;
        
        switch (settingName) {
            case 'homeSections':
                openHomeRowsModal();
                break;
                
            case 'autoLogin':
                settings.autoLogin = !settings.autoLogin;
                saveSettings();
                updateSettingValues();
                
                var message = settings.autoLogin ? 
                    'Auto-login enabled. You will be automatically logged in on app start.' : 
                    'Auto-login disabled. You will need to login manually.';
                break;
                
            case 'clockDisplay':
                // Toggle between 12-hour and 24-hour format
                settings.clockDisplay = settings.clockDisplay === '12-hour' ? '24-hour' : '12-hour';
                saveSettings();
                updateSettingValues();
                // Update clock immediately
                if (typeof NavbarComponent !== 'undefined' && NavbarComponent.updateClock) {
                    NavbarComponent.updateClock();
                }
                break;
                
            case 'skipIntro':
                settings.skipIntro = !settings.skipIntro;
                saveSettings();
                updateSettingValues();
                break;
                
            case 'autoPlay':
                settings.autoPlay = !settings.autoPlay;
                saveSettings();
                updateSettingValues();
                break;
                
            case 'showShuffleButton':
                settings.showShuffleButton = !settings.showShuffleButton;
                saveSettings();
                updateSettingValues();
                applyToolbarSettingsLive();
                break;
                
            case 'showGenresButton':
                settings.showGenresButton = !settings.showGenresButton;
                saveSettings();
                updateSettingValues();
                applyToolbarSettingsLive();
                break;
                
            case 'showFavoritesButton':
                settings.showFavoritesButton = !settings.showFavoritesButton;
                saveSettings();
                updateSettingValues();
                applyToolbarSettingsLive();
                break;
                
            case 'showLibrariesInToolbar':
                settings.showLibrariesInToolbar = !settings.showLibrariesInToolbar;
                saveSettings();
                updateSettingValues();
                applyToolbarSettingsLive();
                break;
                
            case 'theme':
                // Theme switching not implemented yet
                break;
                
            case 'carouselSpeed':
                // Cycle through speeds: 5s, 8s, 10s, 15s, 20s
                var speeds = [5000, 8000, 10000, 15000, 20000];
                var currentIndex = speeds.indexOf(settings.carouselSpeed);
                var nextIndex = (currentIndex + 1) % speeds.length;
                settings.carouselSpeed = speeds[nextIndex];
                saveSettings();
                updateSettingValues();
                break;
                
            case 'imageType':
                // Cycle through: Primary -> Thumb -> Banner -> Primary
                if (settings.imageType === 'Primary') {
                    settings.imageType = 'Thumb';
                } else if (settings.imageType === 'Thumb') {
                    settings.imageType = 'Banner';
                } else {
                    settings.imageType = 'Primary';
                }
                // Always keep posterSize at maximum (300)
                settings.posterSize = 300;
                saveSettings();
                updateSettingValues();
                syncImageHelperSettings();
                break;
                
            case 'preferParentThumb':
                settings.preferParentThumb = !settings.preferParentThumb;
                saveSettings();
                updateSettingValues();
                syncImageHelperSettings();
                break;
                
            case 'merge-continue-watching':
                settings.mergeContinueWatchingNextUp = !settings.mergeContinueWatchingNextUp;
                saveSettings();
                updateSettingValues();
                break;
                
            case 'show-featured-banner':
                settings.showFeaturedBanner = !settings.showFeaturedBanner;
                saveSettings();
                updateSettingValues();
                break;
                
            case 'backdrop-blur-home':
                enterSliderMode('backdrop-blur-home', settings.backdropBlurHome);
                break;
                
            case 'backdrop-blur-detail':
                enterSliderMode('backdrop-blur-detail', settings.backdropBlurDetail);
                break;
                
            case 'logout':
                handleLogout();
                break;
                
            default:
                JellyfinAPI.Logger.warn('Setting not implemented:', settingName);
        }
    }

    /**
     * Open the Home Rows configuration modal
     * @private
     */
    function openHomeRowsModal() {
        var modal = document.getElementById('homeRowsModal');
        if (!modal) return;
        
        homeRowsModal.rows = JSON.parse(JSON.stringify(settings.homeRows));
        homeRowsModal.isOpen = true;
        homeRowsModal.focusedIndex = 0;
        
        renderHomeRowsList();
        modal.style.display = 'flex';
        
        // Setup modal event listeners with cleanup support
        var saveBtn = document.getElementById('saveRowsBtn');
        var cancelBtn = document.getElementById('cancelRowsBtn');
        var resetBtn = document.getElementById('resetRowsBtn');
        
        if (saveBtn) {
            homeRowsModal.saveHandler = saveHomeRows;
            saveBtn.addEventListener('click', homeRowsModal.saveHandler);
        }
        if (cancelBtn) {
            homeRowsModal.cancelHandler = closeHomeRowsModal;
            cancelBtn.addEventListener('click', homeRowsModal.cancelHandler);
        }
        if (resetBtn) {
            homeRowsModal.resetHandler = resetHomeRows;
            resetBtn.addEventListener('click', homeRowsModal.resetHandler);
        }
        
        // Focus first item
        setTimeout(function() {
            updateHomeRowsFocus();
        }, 100);
    }

    /**
     * Render the home rows list in the modal
     * @private
     */
    function renderHomeRowsList() {
        var list = document.getElementById('homeRowsList');
        if (!list) return;
        
        list.innerHTML = '';
        
        // Sort by order
        homeRowsModal.rows.sort(function(a, b) {
            return a.order - b.order;
        });
        
        homeRowsModal.rows.forEach(function(row, index) {
            var rowDiv = document.createElement('div');
            rowDiv.className = 'home-row-item';
            rowDiv.dataset.rowId = row.id;
            rowDiv.dataset.index = index;
            rowDiv.tabIndex = 0;
            
            var checkbox = document.createElement('div');
            checkbox.className = 'row-checkbox ' + (row.enabled ? 'checked' : '');
            checkbox.textContent = row.enabled ? '✓' : '';
            
            var name = document.createElement('div');
            name.className = 'row-name';
            name.textContent = row.name;
            
            var controls = document.createElement('div');
            controls.className = 'row-controls';
            
            var upBtn = document.createElement('button');
            upBtn.className = 'row-btn';
            upBtn.textContent = '▲';
            upBtn.disabled = index === 0;
            upBtn.onclick = function(e) {
                e.stopPropagation();
                moveRowUp(index);
            };
            
            var downBtn = document.createElement('button');
            downBtn.className = 'row-btn';
            downBtn.textContent = '▼';
            downBtn.disabled = index === homeRowsModal.rows.length - 1;
            downBtn.onclick = function(e) {
                e.stopPropagation();
                moveRowDown(index);
            };
            
            controls.appendChild(upBtn);
            controls.appendChild(downBtn);
            
            rowDiv.appendChild(checkbox);
            rowDiv.appendChild(name);
            rowDiv.appendChild(controls);
            
            rowDiv.onclick = function() {
                toggleRowEnabled(index);
            };
            
            list.appendChild(rowDiv);
        });
    }

    /**
     * Toggle a row's enabled state
     * @param {number} index - Row index
     * @private
     */
    function toggleRowEnabled(index) {
        homeRowsModal.rows[index].enabled = !homeRowsModal.rows[index].enabled;
        renderHomeRowsList();
        updateHomeRowsFocus();
    }

    /**
     * Move a row up in the order
     * @param {number} index - Row index
     * @private
     */
    function moveRowUp(index) {
        if (index === 0) return;
        
        var temp = homeRowsModal.rows[index];
        homeRowsModal.rows[index] = homeRowsModal.rows[index - 1];
        homeRowsModal.rows[index - 1] = temp;
        
        // Update order values
        homeRowsModal.rows.forEach(function(row, i) {
            row.order = i;
        });
        
        homeRowsModal.focusedIndex = index - 1;
        renderHomeRowsList();
        updateHomeRowsFocus();
    }

    /**
     * Move a row down in the order
     * @param {number} index - Row index
     * @private
     */
    function moveRowDown(index) {
        if (index >= homeRowsModal.rows.length - 1) return;
        
        var temp = homeRowsModal.rows[index];
        homeRowsModal.rows[index] = homeRowsModal.rows[index + 1];
        homeRowsModal.rows[index + 1] = temp;
        
        // Update order values
        homeRowsModal.rows.forEach(function(row, i) {
            row.order = i;
        });
        
        homeRowsModal.focusedIndex = index + 1;
        renderHomeRowsList();
        updateHomeRowsFocus();
    }

    /**
     * Update focus in home rows list
     * @private
     */
    function updateHomeRowsFocus() {
        var items = document.querySelectorAll('.home-row-item');
        items.forEach(function(item, index) {
            if (index === homeRowsModal.focusedIndex) {
                item.classList.add('focused');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                item.classList.remove('focused');
            }
        });
    }

    /**
     * Save home rows configuration
     * @private
     */
    function saveHomeRows() {
        settings.homeRows = JSON.parse(JSON.stringify(homeRowsModal.rows));
        saveSettings();
        closeHomeRowsModal();
        
        JellyfinAPI.Logger.success('Home rows configuration saved');
    }

    /**
     * Reset home rows to defaults
     * @private
     */
    function resetHomeRows() {
        homeRowsModal.rows = JSON.parse(JSON.stringify(defaultHomeRows));
        homeRowsModal.focusedIndex = 0;
        renderHomeRowsList();
        updateHomeRowsFocus();
    }

    /**
     * Close the home rows modal
     * Cleans up event listeners to prevent memory leaks
     * @private
     */
    function closeHomeRowsModal() {
        var modal = document.getElementById('homeRowsModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        // Remove event listeners to prevent memory leaks
        var saveBtn = document.getElementById('saveRowsBtn');
        var cancelBtn = document.getElementById('cancelRowsBtn');
        var resetBtn = document.getElementById('resetRowsBtn');
        
        if (saveBtn && homeRowsModal.saveHandler) {
            saveBtn.removeEventListener('click', homeRowsModal.saveHandler);
        }
        if (cancelBtn && homeRowsModal.cancelHandler) {
            cancelBtn.removeEventListener('click', homeRowsModal.cancelHandler);
        }
        if (resetBtn && homeRowsModal.resetHandler) {
            resetBtn.removeEventListener('click', homeRowsModal.resetHandler);
        }
        
        // Clear handler references
        homeRowsModal.saveHandler = null;
        homeRowsModal.cancelHandler = null;
        homeRowsModal.resetHandler = null;
        
        homeRowsModal.isOpen = false;
        focusToContent();
    }

    /**
     * Handle keyboard navigation in home rows modal
     * @param {KeyboardEvent} evt - Keyboard event
     * @private
     */
    function handleHomeRowsModalNavigation(evt) {
        var items = document.querySelectorAll('.home-row-item');
        var buttons = document.querySelectorAll('.modal-actions button');
        var totalItems = items.length;
        
        switch (evt.keyCode) {
            case KeyCodes.UP:
                evt.preventDefault();
                if (homeRowsModal.focusedIndex > 0) {
                    homeRowsModal.focusedIndex--;
                    updateHomeRowsFocus();
                }
                break;
                
            case KeyCodes.DOWN:
                evt.preventDefault();
                if (homeRowsModal.focusedIndex < totalItems - 1) {
                    homeRowsModal.focusedIndex++;
                    updateHomeRowsFocus();
                } else if (homeRowsModal.focusedIndex === totalItems - 1) {
                    // Move to buttons
                    buttons[0].focus();
                }
                break;
                
            case KeyCodes.LEFT:
                evt.preventDefault();
                moveRowUp(homeRowsModal.focusedIndex);
                break;
                
            case KeyCodes.RIGHT:
                evt.preventDefault();
                moveRowDown(homeRowsModal.focusedIndex);
                break;
                
            case KeyCodes.ENTER:
                evt.preventDefault();
                var currentItem = items[homeRowsModal.focusedIndex];
                if (currentItem) {
                    currentItem.click();
                }
                break;
                
            case KeyCodes.BACK:
                evt.preventDefault();
                closeHomeRowsModal();
                break;
        }
    }

    function handleLogout() {
        JellyfinAPI.logout();
        window.location.href = 'login.html';
    }

    /**
     * Apply toolbar settings live to the current page's navbar
     * @private
     */
    function applyToolbarSettingsLive() {
        var shuffleBtn = document.getElementById('shuffleBtn');
        var genresBtn = document.getElementById('genresBtn');
        var favoritesBtn = document.getElementById('favoritesBtn');
        var libraryButtons = document.querySelectorAll('.nav-btn[data-library-id]');
        
        if (shuffleBtn) {
            shuffleBtn.style.display = settings.showShuffleButton ? '' : 'none';
        }
        
        if (genresBtn) {
            genresBtn.style.display = settings.showGenresButton ? '' : 'none';
        }
        
        if (favoritesBtn) {
            favoritesBtn.style.display = settings.showFavoritesButton ? '' : 'none';
        }
        
        // Apply library buttons visibility
        if (libraryButtons && libraryButtons.length > 0) {
            libraryButtons.forEach(function(btn) {
                btn.style.display = settings.showLibrariesInToolbar ? '' : 'none';
            });
        }
    }
    
    /**
     * Sync settings with ImageHelper module
     * @private
     */
    function syncImageHelperSettings() {
        if (typeof ImageHelper === 'undefined') return;
        
        ImageHelper.setImageType(settings.imageType);
        ImageHelper.setPosterSize(settings.posterSize);
        ImageHelper.setPreferParentThumb(settings.preferParentThumb);
    }

    /**
     * Get home rows settings for use by other pages
     * @returns {Array} Array of home row configurations
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
        return JSON.parse(JSON.stringify(defaultHomeRows));
    }

    /**
     * Enter slider mode for blur settings
     * @param {string} settingName - The setting name
     * @param {number} currentValue - The current value
     * @private
     */
    function enterSliderMode(settingName, currentValue) {
        focusManager.inSliderMode = true;
        focusManager.sliderSetting = settingName;
        
        var settingItem = document.querySelector('[data-setting="' + settingName + '"]');
        if (!settingItem) return;
        
        // Initialize slider with current value
        var percentage = (currentValue / 5) * 100;
        var fillElement = settingItem.querySelector('.slider-fill');
        var sliderValueDisplay = settingItem.querySelector('.slider-value-display');
        
        if (fillElement) {
            fillElement.style.width = percentage + '%';
        }
        if (sliderValueDisplay) {
            sliderValueDisplay.textContent = currentValue;
        }
        
        // Hide the value display, show the slider
        var valueDisplay = settingItem.querySelector('.setting-value');
        var sliderContainer = settingItem.querySelector('.slider-container');
        
        if (valueDisplay) valueDisplay.style.display = 'none';
        if (sliderContainer) sliderContainer.style.display = 'flex';
        
        settingItem.classList.add('slider-active');
    }

    /**
     * Exit slider mode and update setting
     * @param {string} settingName - The setting name
     * @param {number} newValue - The new value
     * @private
     */
    function exitSliderMode(settingName, newValue) {
        focusManager.inSliderMode = false;
        focusManager.sliderSetting = null;
        
        // Update the setting based on which blur control
        if (settingName === 'backdrop-blur-home') {
            settings.backdropBlurHome = newValue;
        } else if (settingName === 'backdrop-blur-detail') {
            settings.backdropBlurDetail = newValue;
        }
        
        saveSettings();
        updateSettingValues();
        
        var settingItem = document.querySelector('[data-setting="' + settingName + '"]');
        if (!settingItem) return;
        
        // Show the value display, hide the slider
        var valueDisplay = settingItem.querySelector('.setting-value');
        var sliderContainer = settingItem.querySelector('.slider-container');
        
        if (valueDisplay) valueDisplay.style.display = 'block';
        if (sliderContainer) sliderContainer.style.display = 'none';
        
        settingItem.classList.remove('slider-active');
    }

    /**
     * Handle navigation within slider mode
     * @param {KeyboardEvent} evt - Keyboard event
     * @private
     */
    function handleSliderNavigation(evt) {
        var settingName = focusManager.sliderSetting;
        var currentValue = settingName === 'backdrop-blur-home' ? settings.backdropBlurHome : settings.backdropBlurDetail;
        
        switch (evt.keyCode) {
            case KeyCodes.LEFT: // Left - decrease value
                evt.preventDefault();
                if (currentValue > 0) {
                    var newValue = Math.max(0, currentValue - 1);
                    updateSliderDisplay(settingName, newValue);
                }
                break;
                
            case KeyCodes.RIGHT: // Right - increase value
                evt.preventDefault();
                if (currentValue < 5) {
                    var newValue = Math.min(5, currentValue + 1);
                    updateSliderDisplay(settingName, newValue);
                }
                break;
                
            case KeyCodes.UP: // Up - increase value
                evt.preventDefault();
                if (currentValue < 5) {
                    var newValue = Math.min(5, currentValue + 1);
                    updateSliderDisplay(settingName, newValue);
                }
                break;
                
            case KeyCodes.DOWN: // Down - decrease value
                evt.preventDefault();
                if (currentValue > 0) {
                    var newValue = Math.max(0, currentValue - 1);
                    updateSliderDisplay(settingName, newValue);
                }
                break;
                
            case KeyCodes.ENTER: // Enter - confirm and exit slider mode
                evt.preventDefault();
                exitSliderMode(settingName, currentValue);
                break;
                
            case KeyCodes.BACKSPACE: // Back - cancel slider mode
            case KeyCodes.ESCAPE:
                evt.preventDefault();
                // Reset to original value
                exitSliderMode(settingName, settingName === 'backdrop-blur-home' ? settings.backdropBlurHome : settings.backdropBlurDetail);
                break;
        }
    }

    /**
     * Update the slider display as user adjusts value
     * @param {string} settingName - The setting name
     * @param {number} newValue - The new value
     * @private
     */
    function updateSliderDisplay(settingName, newValue) {
        // Update setting temporarily (for display)
        if (settingName === 'backdrop-blur-home') {
            settings.backdropBlurHome = newValue;
        } else if (settingName === 'backdrop-blur-detail') {
            settings.backdropBlurDetail = newValue;
        }
        
        // Temporarily save to apply the blur in real-time
        saveSettings();
        
        // Apply blur to current page in real-time (if applicable)
        if (settingName === 'backdrop-blur-home') {
            var homeBackdrop = document.getElementById('globalBackdropImage');
            if (homeBackdrop && typeof storage !== 'undefined') {
                storage.applyBackdropBlur(homeBackdrop, 'backdropBlurHome', 20);
            }
        } else if (settingName === 'backdrop-blur-detail') {
            var detailBackdrop = document.querySelector('.backdrop-image');
            if (detailBackdrop && typeof storage !== 'undefined') {
                storage.applyBackdropBlur(detailBackdrop, 'backdropBlurDetail', 15);
            }
        }
        
        // Find the setting item - first try active panel, then search all panels
        var settingItem = document.querySelector('[data-setting="' + settingName + '"]');
        if (!settingItem) return;
        
        // Update the slider fill width (0-5 maps to 0-100%)
        var fillElement = settingItem.querySelector('.slider-fill');
        if (fillElement) {
            var percentage = (newValue / 5) * 100;
            fillElement.style.width = percentage + '%';
        }
        
        // Update the slider value display
        var sliderValueDisplay = settingItem.querySelector('.slider-value-display');
        if (sliderValueDisplay) {
            sliderValueDisplay.textContent = newValue;
        }
    }

    return {
        init: init,
        getHomeRowsSettings: getHomeRowsSettings
    };
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', SettingsController.init);
} else {
    SettingsController.init();
}
