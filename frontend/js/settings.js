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
    
    // Carousel Speed Options (in milliseconds)
    const CAROUSEL_SPEEDS = [5000, 8000, 10000, 15000, 20000];
    const DEFAULT_CAROUSEL_SPEED_MS = 8000;
    const CAROUSEL_SPEED_TO_SECONDS = 1000;

    var settings = {
    /**
     * Play theme music in details view
     * @type {boolean}
     */
    playThemeMusic: true,
        autoLogin: false,
        clockDisplay: '12-hour',
        skipIntro: true,
        autoPlay: true,
        theme: 'dark',
        accentColor: 'blue',
        carouselSpeed: DEFAULT_CAROUSEL_SPEED_MS,
        homeRows: null, // Will be initialized with defaults
        showShuffleButton: true,
        showGenresButton: true,
        showFavoritesButton: true,
        showLibrariesInToolbar: true,
        showFeaturedBanner: true,
        // Image Helper settings
        imageType: 'Primary',
        posterSize: 300, // X-Large (always highest quality)
        // Continue Watching settings
        mergeContinueWatchingNextUp: false,
        // Backdrop blur settings
        backdropBlurHome: 3,
        backdropBlurDetail: 3,
        // Jellyseerr settings
        jellyseerrEnabled: false,
        jellyseerrUrl: '',
        jellyseerrFilterNSFW: true
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
        applyAccentColor();
        
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
            accentColor: 'blue',
            carouselSpeed: DEFAULT_CAROUSEL_SPEED_MS,
            showShuffleButton: true,
            showGenresButton: true,
            showFavoritesButton: true,
            showLibrariesInToolbar: true,
            showFeaturedBanner: true,
            featuredMediaFilter: 'both',
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
        
        // Apply accent color on load
        applyAccentColor();
    }

    /**
     * Save current settings to persistent storage
     * @private
     */
    function saveSettings() {
        storage.set('jellyfin_settings', JSON.stringify(settings));
    }

    /**
     * Apply the selected accent color to the page
     * @private
     */
    function applyAccentColor() {
        var root = document.documentElement;
        if (settings.accentColor === 'purple') {
            root.style.setProperty('--accent-color', '#6d4aff');
            root.style.setProperty('--accent-color-rgb', '109, 74, 255');
        } else {
            root.style.setProperty('--accent-color', '#007bff');
            root.style.setProperty('--accent-color-rgb', '0, 123, 255');
        }
    }

    /**
     * Update all setting value displays in the UI
     * @private
     */
    function updateSettingValues() {
        // Update theme music setting value
        var playThemeMusicValue = document.getElementById('playThemeMusicValue');
        if (playThemeMusicValue) {
            playThemeMusicValue.textContent = settings.playThemeMusic ? 'On' : 'Off';
        }
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
        
        var accentColorValue = document.getElementById('accentColorValue');
        if (accentColorValue) {
            accentColorValue.textContent = settings.accentColor === 'blue' ? 'Blue' : 'Purple';
        }
        
        var carouselSpeedValue = document.getElementById('carouselSpeedValue');
        if (carouselSpeedValue) {
            carouselSpeedValue.textContent = (settings.carouselSpeed / CAROUSEL_SPEED_TO_SECONDS) + ' seconds';
        }
        
        // Image Helper settings
        var imageTypeValue = document.getElementById('imageTypeValue');
        if (imageTypeValue) {
            var imageTypeText = settings.imageType === 'Primary' ? 'Poster' : 'Thumbnail';
            imageTypeValue.textContent = imageTypeText;
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
        
        var featuredMediaFilterValue = document.getElementById('featured-media-filter-value');
        if (featuredMediaFilterValue) {
            var filterText = 'Both';
            if (settings.featuredMediaFilter === 'movies') {
                filterText = 'Movies Only';
            } else if (settings.featuredMediaFilter === 'tv') {
                filterText = 'TV Shows Only';
            }
            featuredMediaFilterValue.textContent = filterText;
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
        
        // Jellyseerr settings
        updateJellyseerrSettingValues();
    }
    
    /**
     * Update Jellyseerr-specific setting values
     * @private
     */
    function updateJellyseerrSettingValues() {
        var jellyseerrEnabledValue = document.getElementById('jellyseerrEnabledValue');
        if (jellyseerrEnabledValue) {
            jellyseerrEnabledValue.textContent = settings.jellyseerrEnabled ? 'On' : 'Off';
        }
        
        var jellyseerrUrlValue = document.getElementById('jellyseerrUrlValue');
        if (jellyseerrUrlValue) {
            jellyseerrUrlValue.textContent = settings.jellyseerrUrl || 'Not Set';
        }
        
        var jellyseerrAutoRequestValue = document.getElementById('jellyseerrAutoRequestValue');
        if (jellyseerrAutoRequestValue) {
            jellyseerrAutoRequestValue.textContent = settings.jellyseerrAutoRequest ? 'On' : 'Off';
        }
        
        var jellyseerrNotificationsValue = document.getElementById('jellyseerrNotificationsValue');
        if (jellyseerrNotificationsValue) {
            jellyseerrNotificationsValue.textContent = settings.jellyseerrNotifications ? 'On' : 'Off';
        }
        
        var jellyseerrFilterNSFWValue = document.getElementById('jellyseerrFilterNSFWValue');
        if (jellyseerrFilterNSFWValue) {
            jellyseerrFilterNSFWValue.textContent = settings.jellyseerrFilterNSFW ? 'On' : 'Off';
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
        
        // Alert modal OK button
        var alertOkBtn = document.getElementById('alertOkBtn');
        if (alertOkBtn) {
            alertOkBtn.addEventListener('click', closeAlert);
        }
    }

    /**
     * ModalManager - Handles modal display, event management, and cleanup
     * @class
     */
    var ModalManager = {
        /**
         * Show a modal with inputs and buttons
         * @param {Object} config - Modal configuration
         * @param {string} config.modalId - Modal element ID
         * @param {string[]} config.inputIds - Input element IDs
         * @param {string[]} config.buttonIds - Button element IDs (save, cancel)
         * @param {Function} config.onSave - Save handler function
         * @param {Function} config.onCancel - Cancel handler function
         * @param {string} [config.focusTarget] - ID of element to focus (defaults to first input)
         * @param {string} [config.focusReturn] - Selector for element to focus when closing
         * @param {boolean} [config.clearInputs] - Whether to clear input values (default: true)
         */
        show: function(config) {
            var modal = document.getElementById(config.modalId);
            if (!modal) return;
            
            // Get all elements
            var inputs = config.inputIds.map(function(id) {
                return document.getElementById(id);
            }).filter(function(el) { return el !== null; });
            
            var buttons = config.buttonIds.map(function(id) {
                return document.getElementById(id);
            }).filter(function(el) { return el !== null; });
            
            // Clear input values only if requested (default true for backward compatibility)
            if (config.clearInputs !== false) {
                inputs.forEach(function(input) {
                    input.value = '';
                });
            }
            
            // Show modal
            modal.style.display = 'flex';
            
            // Create handlers
            var saveHandler = function() {
                config.onSave(inputs);
            };
            
            var cancelHandler = function() {
                config.onCancel();
            };
            
            var enterHandler = function(e) {
                if (e.keyCode === KeyCodes.ENTER) {
                    saveHandler();
                }
            };
            
            // Add event listeners
            if (buttons[0]) buttons[0].addEventListener('click', saveHandler);
            if (buttons[1]) buttons[1].addEventListener('click', cancelHandler);
            inputs.forEach(function(input) {
                input.addEventListener('keydown', enterHandler);
            });
            
            // Store handlers for cleanup
            modal._saveHandler = saveHandler;
            modal._cancelHandler = cancelHandler;
            modal._enterHandler = enterHandler;
            modal._config = config;
            
            // Focus
            setTimeout(function() {
                var focusElement = config.focusTarget ? 
                    document.getElementById(config.focusTarget) : inputs[0];
                if (focusElement) focusElement.focus();
            }, 100);
        },
        
        /**
         * Close a modal and cleanup event listeners
         * @param {string} modalId - Modal element ID
         */
        close: function(modalId) {
            var modal = document.getElementById(modalId);
            if (!modal) return;
            
            var config = modal._config;
            if (!config) {
                modal.style.display = 'none';
                return;
            }
            
            // Get elements
            var inputs = config.inputIds.map(function(id) {
                return document.getElementById(id);
            }).filter(function(el) { return el !== null; });
            
            var buttons = config.buttonIds.map(function(id) {
                return document.getElementById(id);
            }).filter(function(el) { return el !== null; });
            
            // Remove event listeners
            if (modal._saveHandler && buttons[0]) {
                buttons[0].removeEventListener('click', modal._saveHandler);
            }
            if (modal._cancelHandler && buttons[1]) {
                buttons[1].removeEventListener('click', modal._cancelHandler);
            }
            if (modal._enterHandler) {
                inputs.forEach(function(input) {
                    input.removeEventListener('keydown', modal._enterHandler);
                });
            }
            
            // Cleanup
            delete modal._saveHandler;
            delete modal._cancelHandler;
            delete modal._enterHandler;
            delete modal._config;
            
            // Hide modal
            modal.style.display = 'none';
            
            // Return focus
            if (config.focusReturn) {
                var returnElement = document.querySelector(config.focusReturn);
                if (returnElement) {
                    setTimeout(function() {
                        returnElement.focus();
                    }, 100);
                }
            }
        }
    };

    // Modal configuration registry
    var modalConfigs = {
        alert: {
            modalId: 'customAlertModal',
            closeHandler: closeAlert,
            fieldIds: ['alertOkBtn'],
            simpleMode: true // Only BACK/ENTER to close
        },
        jellyseerrUrl: {
            modalId: 'jellyseerrUrlModal',
            closeHandler: closeJellyseerrUrlModal,
            fieldIds: ['jellyseerrUrlInput', 'saveJellyseerrUrlBtn', 'cancelJellyseerrUrlBtn']
        },
        jellyseerrJellyfinAuth: {
            modalId: 'jellyseerrJellyfinAuthModal',
            closeHandler: closeJellyseerrJellyfinAuthModal,
            fieldIds: ['jellyseerrJellyfinAuthPasswordInput', 'saveJellyseerrJellyfinAuthBtn', 'cancelJellyseerrJellyfinAuthBtn']
        },
        jellyseerrLocal: {
            modalId: 'jellyseerrLocalModal',
            closeHandler: closeJellyseerrLocalModal,
            fieldIds: ['jellyseerrEmailInput', 'jellyseerrLocalPasswordInput', 
                       'saveJellyseerrLocalBtn', 'cancelJellyseerrLocalBtn']
        }
    };

    /**
     * Generic modal keyboard handler
     * @param {KeyboardEvent} evt - Keyboard event
     * @param {Object} config - Modal configuration
     * @returns {boolean} True if modal was handled
     * @private
     */
    function handleGenericModal(evt, config) {
        var modal = document.getElementById(config.modalId);
        if (!modal || modal.style.display !== 'flex') {
            return false; // Modal not open
        }
        
        // Handle BACK key
        if (evt.keyCode === KeyCodes.BACK) {
            evt.preventDefault();
            config.closeHandler();
            return true;
        }
        
        // For simple modals (like alert), also close on ENTER
        if (config.simpleMode && evt.keyCode === KeyCodes.ENTER) {
            evt.preventDefault();
            config.closeHandler();
            return true;
        }
        
        // Handle ENTER on buttons
        if (evt.keyCode === KeyCodes.ENTER) {
            var activeElement = document.activeElement;
            if (activeElement && activeElement.tagName === 'BUTTON') {
                evt.preventDefault();
                activeElement.click();
                return true;
            }
        }
        
        // Get modal fields and handle navigation
        var fields = config.fieldIds.map(function(id) {
            return document.getElementById(id);
        }).filter(function(el) { return el !== null; });
        
        return handleModalFieldNavigation(evt, fields);
    }

    function handleKeyDown(evt) {
        evt = evt || window.event;
        
        // Check all generic modals
        for (var key in modalConfigs) {
            if (handleGenericModal(evt, modalConfigs[key])) {
                return;
            }
        }
        
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
        case 'playThemeMusic':
            // Toggle theme music setting
            settings.playThemeMusic = !settings.playThemeMusic;
            saveSettings();
            updateSettingValues();
            if (typeof ThemeMusicPlayer !== 'undefined') {
                ThemeMusicPlayer.setEnabled(settings.playThemeMusic);
            }
            break;
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
                
            case 'accentColor':
                settings.accentColor = settings.accentColor === 'blue' ? 'purple' : 'blue';
                saveSettings();
                applyAccentColor();
                updateSettingValues();
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
                
            case 'jellyseerrEnabled':
                settings.jellyseerrEnabled = !settings.jellyseerrEnabled;
                saveSettings();
                updateSettingValues();
                if (settings.jellyseerrEnabled && settings.jellyseerrUrl) {
                    initializeJellyseerr();
                }
                // Update navbar to show/hide Jellyseerr buttons
                applyToolbarSettingsLive();
                if (typeof NavbarController !== 'undefined' && NavbarController.checkJellyseerrAvailability) {
                    NavbarController.checkJellyseerrAvailability();
                }
                break;
                
            case 'jellyseerrUrl':
                promptJellyseerrUrl();
                break;
                
            case 'jellyseerrAuthJellyfin':
                handleJellyseerrAuthJellyfin();
                break;
                
            case 'jellyseerrAuthLocal':
                handleJellyseerrAuthLocal();
                break;
                
            case 'testJellyseerrConnection':
                testJellyseerrConnection();
                break;
                
            case 'jellyseerrAutoRequest':
                settings.jellyseerrAutoRequest = !settings.jellyseerrAutoRequest;
                saveSettings();
                updateSettingValues();
                break;
                
            case 'imageType':
                // Toggle between: Primary <-> Thumb
                if (settings.imageType === 'Primary') {
                    settings.imageType = 'Thumb';
                } else {
                    settings.imageType = 'Primary';
                }
                // Always keep posterSize at maximum (300)
                settings.posterSize = 300;
                saveSettings();
                updateSettingValues();
                syncImageHelperSettings();
                break;
                
            case 'merge-continue-watching':
                settings.mergeContinueWatchingNextUp = !settings.mergeContinueWatchingNextUp;
                saveSettings();
                updateSettingValues();
                break;
                
            case 'jellyseerrQuality':
                settings.jellyseerrQuality = settings.jellyseerrQuality === 'standard' ? '4k' : 'standard';
                saveSettings();
                updateSettingValues();
                break;
                
            case 'jellyseerrNotifications':
                settings.jellyseerrNotifications = !settings.jellyseerrNotifications;
                saveSettings();
                updateSettingValues();
                
                // Sync notification preferences with Jellyseerr server
                syncNotificationPreferences();
                break;
                
            case 'jellyseerrShowDiscover':
                settings.jellyseerrShowDiscover = !settings.jellyseerrShowDiscover;
                saveSettings();
                updateSettingValues();
                break;
                
            case 'show-featured-banner':
                settings.showFeaturedBanner = !settings.showFeaturedBanner;
                saveSettings();
                updateSettingValues();
                break;
                
            case 'featured-media-filter':
                // Cycle through: both -> movies -> tv -> both
                if (settings.featuredMediaFilter === 'both') {
                    settings.featuredMediaFilter = 'movies';
                } else if (settings.featuredMediaFilter === 'movies') {
                    settings.featuredMediaFilter = 'tv';
                } else {
                    settings.featuredMediaFilter = 'both';
                }
                saveSettings();
                updateSettingValues();
                break;
                
            case 'jellyseerrFilterNSFW':
                settings.jellyseerrFilterNSFW = !settings.jellyseerrFilterNSFW;
                saveSettings();
                updateSettingValues();
                break;
                
            case 'backdrop-blur-home':
                enterSliderMode('backdrop-blur-home', settings.backdropBlurHome);
                break;
                
            case 'backdrop-blur-detail':
                enterSliderMode('backdrop-blur-detail', settings.backdropBlurDetail);
                break;
                
            case 'clearJellyseerrCache':
                clearJellyseerrCache();
                break;
                
            case 'disconnectJellyseerr':
                disconnectJellyseerr();
                break;
                
            case 'logout':
                handleLogout();
                break;
                
            default:
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
        var buttons = document.querySelectorAll('#homeRowsModal .modal-actions button');
        var totalItems = items.length;
        var activeElement = document.activeElement;
        
        // Check if a button is currently focused
        var buttonFocused = false;
        var currentButtonIndex = -1;
        buttons.forEach(function(btn, index) {
            if (btn === activeElement) {
                buttonFocused = true;
                currentButtonIndex = index;
            }
        });
        
        if (buttonFocused) {
            // Handle navigation when a button is focused
            switch (evt.keyCode) {
                case KeyCodes.UP:
                    evt.preventDefault();
                    // Go back to the list (last item)
                    homeRowsModal.focusedIndex = totalItems - 1;
                    updateHomeRowsFocus();
                    break;
                    
                case KeyCodes.LEFT:
                    evt.preventDefault();
                    // Move to previous button
                    if (currentButtonIndex > 0) {
                        buttons[currentButtonIndex - 1].focus();
                    }
                    break;
                    
                case KeyCodes.RIGHT:
                    evt.preventDefault();
                    // Move to next button
                    if (currentButtonIndex < buttons.length - 1) {
                        buttons[currentButtonIndex + 1].focus();
                    }
                    break;
                    
                case KeyCodes.BACK:
                    evt.preventDefault();
                    closeHomeRowsModal();
                    break;
            }
        } else {
            // Handle navigation when a list item is focused
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
                        // Move to first button (Reset to Default)
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
    }

    function handleLogout() {
        var returnFocus = document.querySelector('[data-setting="logout"]');
        
        showConfirm(
            'Are you sure you want to sign out? You will be redirected to the login page.',
            'Sign Out',
            function() {
                JellyfinAPI.logout();
                window.location.href = 'login.html';
            },
            function() {
                if (returnFocus) returnFocus.focus();
            }
        );
    }

    /**
     * Apply toolbar settings live to the current page's navbar
     * @private
     */
    function applyToolbarSettingsLive() {
        var shuffleBtn = document.getElementById('shuffleBtn');
        var genresBtn = document.getElementById('genresBtn');
        var favoritesBtn = document.getElementById('favoritesBtn');
        var discoverBtn = document.getElementById('discoverBtn');
        var requestsBtn = document.getElementById('requestsBtn');
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
        
        // Hide Jellyseerr buttons if Jellyseerr is disabled
        if (!settings.jellyseerrEnabled) {
            if (discoverBtn) {
                discoverBtn.style.display = 'none';
            }
            if (requestsBtn) {
                requestsBtn.style.display = 'none';
            }
        }
    }
    
    /**
     * Sync settings with ImageHelper module
     * @private
     */
    function syncImageHelperSettings() {
        // Sync theme music setting
        if (typeof ThemeMusicPlayer !== 'undefined') {
            ThemeMusicPlayer.setEnabled(settings.playThemeMusic);
        }
        if (typeof ImageHelper === 'undefined') return;
        
        ImageHelper.setImageType(settings.imageType);
        ImageHelper.setPosterSize(settings.posterSize);
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
                // Settings parsing failed, return defaults
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

    // ==================== Jellyseerr Functions ====================

    /**
     * Initialize Jellyseerr connection
     * @private
     */
    /**
     * Initialize Jellyseerr integration
     * @private
     */
    function initializeJellyseerr() {
        // In settings context, use the in-memory settings object if available
        if (!settings.jellyseerrEnabled || !settings.jellyseerrUrl) {
            return Promise.resolve(false);
        }
        
        return JellyseerrAPI.initializeFromPreferences();
    }

    /**
     * Prompt for Jellyseerr URL using modal
     * @private
     */
    function promptJellyseerrUrl() {
        var input = document.getElementById('jellyseerrUrlInput');
        if (input) {
            input.value = settings.jellyseerrUrl || '';
        }
        
        ModalManager.show({
            modalId: 'jellyseerrUrlModal',
            inputIds: ['jellyseerrUrlInput'],
            buttonIds: ['saveJellyseerrUrlBtn', 'cancelJellyseerrUrlBtn'],
            focusReturn: '[data-setting="jellyseerrUrl"]',
            clearInputs: false, // Preserve current URL value for editing
            onSave: function(inputs) {
                var newUrl = inputs[0].value.trim();
                
                if (newUrl !== '') {
                    // Basic URL validation
                    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
                        showAlert('Invalid URL. Please include http:// or https://', 'Invalid URL');
                        return;
                    }
                    
                    settings.jellyseerrUrl = newUrl;
                    saveSettings();
                    updateSettingValues();
                    
                    if (settings.jellyseerrEnabled) {
                        initializeJellyseerr();
                    }
                }
                
                closeJellyseerrUrlModal();
            },
            onCancel: closeJellyseerrUrlModal
        });
    }
    
    /**
     * Close Jellyseerr URL modal
     * @private
     */
    function closeJellyseerrUrlModal() {
        ModalManager.close('jellyseerrUrlModal');
    }

    /**
     * Handle Jellyseerr Jellyfin authentication
     * @private
     */
    function handleJellyseerrAuthJellyfin() {
        if (!settings.jellyseerrEnabled) {
            showAlert('Please enable Jellyseerr first', 'Error');
            return;
        }
        
        if (!settings.jellyseerrUrl) {
            showAlert('Please set Jellyseerr URL first', 'Error');
            return;
        }
        
        // Get Jellyfin auth info
        if (!auth || !auth.username || !auth.serverAddress) {
            showAlert('Jellyfin authentication not found', 'Error');
            return;
        }
        
        var username = auth.username;
        var jellyfinUrl = auth.serverAddress;
        var userId = auth.userId;
        
        // Initialize Jellyseerr first with direct initialize() call (not initializeFromPreferences which requires auth)
        console.log('[Settings] Initializing Jellyseerr with URL:', settings.jellyseerrUrl);
        JellyseerrAPI.initialize(settings.jellyseerrUrl, null, userId).then(function() {
            console.log('[Settings] Jellyseerr initialized successfully');
            // Show Jellyfin authentication modal
            showJellyseerrJellyfinAuthModal(username, jellyfinUrl);
        }).catch(function(error) {
            console.error('[Settings] Failed to initialize Jellyseerr:', error);
            showAlert('Failed to initialize Jellyseerr. Please check your server URL.', 'Initialization Error');
        });
    }

    /**
     * Handle Jellyseerr local account authentication
     * @private
     */
    function handleJellyseerrAuthLocal() {
        if (!settings.jellyseerrEnabled) {
            showAlert('Please enable Jellyseerr first', 'Error');
            return;
        }
        
        if (!settings.jellyseerrUrl) {
            showAlert('Please set Jellyseerr URL first', 'Error');
            return;
        }
        
        // Get current user ID for cookie storage
        var userId = auth && auth.userId ? auth.userId : null;
        
        // Initialize Jellyseerr first with direct initialize() call (not initializeFromPreferences which requires auth)
        console.log('[Settings] Initializing Jellyseerr with URL:', settings.jellyseerrUrl);
        JellyseerrAPI.initialize(settings.jellyseerrUrl, null, userId).then(function() {
            console.log('[Settings] Jellyseerr initialized successfully');
            // Show local login modal
            showJellyseerrLocalModal();
        }).catch(function(error) {
            console.error('[Settings] Failed to initialize Jellyseerr:', error);
            showAlert('Failed to initialize Jellyseerr. Please check your server URL.', 'Initialization Error');
        });
    }

    /**
     * Show Jellyseerr Jellyfin authentication modal
     * @private
     */
    function showJellyseerrJellyfinAuthModal(username, jellyfinUrl) {
        console.log('[Settings] Showing Jellyfin auth modal for user:', username, 'jellyfin URL:', jellyfinUrl);
        
        ModalManager.show({
            modalId: 'jellyseerrJellyfinAuthModal',
            inputIds: ['jellyseerrJellyfinAuthPasswordInput'],
            buttonIds: ['saveJellyseerrJellyfinAuthBtn', 'cancelJellyseerrJellyfinAuthBtn'],
            focusReturn: '[data-setting="jellyseerrAuthJellyfin"]',
            clearInputs: true, // Clear password for security
            onSave: function(inputs) {
                var password = inputs[0].value;
                
                console.log('[Settings] Auth modal onSave called, password length:', password ? password.length : 0);
                console.log('[Settings] Calling JellyseerrAPI.loginWithJellyfin with username:', username);
                
                if (!password) {
                    showAlert('Password is required', 'Error');
                    return;
                }
                
                // Login with Jellyfin SSO
                JellyseerrAPI.loginWithJellyfin(username, password, jellyfinUrl)
                    .then(function(response) {
                        console.log('[Settings] Login successful:', response);
                        var user = response.user;
                        var apiKey = response.apiKey;
                        
                        // Save credentials for auto-login
                        JellyseerrAPI.saveCredentials(username, password, jellyfinUrl);
                        
                        if (apiKey) {
                            // API key was in the login response - save it
                            JellyseerrAPI.setApiKey(apiKey);
                            storage.setJellyseerrSetting('apiKey', apiKey);
                        }
                        
                        // Clear local auth credentials
                        storage.removeJellyseerrUserSetting(auth.userId, 'localEmail');
                        storage.removeJellyseerrUserSetting(auth.userId, 'localPassword');
                        
                        // Reinitialize API to ensure session is active
                        initializeJellyseerr().then(function() {
                            showAlert('Successfully authenticated with Jellyseerr as ' + (user.displayName || user.username) + '!', 'Success');
                            updateSettingValues();
                            closeJellyseerrJellyfinAuthModal();
                        }).catch(function(error) {
                            showAlert('Authentication succeeded but failed to initialize session. Please try again.', 'Warning');
                            closeJellyseerrJellyfinAuthModal();
                        });
                    })
                    .catch(function(error) {
                        console.error('[Settings] Login failed:', error);
                        showAlert('Failed to authenticate with Jellyseerr. Please check your password and try again.', 'Authentication Failed');
                        inputs[0].value = '';
                        inputs[0].focus();
                    });
            },
            onCancel: closeJellyseerrJellyfinAuthModal
        });
    }
    
    /**
     * Close Jellyseerr Jellyfin authentication modal
     * @private
     */
    function closeJellyseerrJellyfinAuthModal() {
        ModalManager.close('jellyseerrJellyfinAuthModal');
    }

    /**
     * Show Jellyseerr local account modal
     * @private
     */
    function showJellyseerrLocalModal() {
        console.log('[Settings] Showing local auth modal');
        
        ModalManager.show({
            modalId: 'jellyseerrLocalModal',
            inputIds: ['jellyseerrEmailInput', 'jellyseerrLocalPasswordInput'],
            buttonIds: ['saveJellyseerrLocalBtn', 'cancelJellyseerrLocalBtn'],
            focusReturn: '[data-setting="jellyseerrAuthLocal"]',
            clearInputs: true, // Clear credentials for security
            onSave: function(inputs) {
                var email = inputs[0].value.trim();
                var password = inputs[1].value;
                
                console.log('[Settings] Local auth onSave called, email:', email, 'password length:', password ? password.length : 0);
                
                if (!email || !password) {
                    showAlert('Email and password are required', 'Error');
                    return;
                }
                
                console.log('[Settings] Calling JellyseerrAPI.loginLocal');
                
                JellyseerrAPI.loginLocal(email, password)
                    .then(function(response) {
                        console.log('[Settings] Local login successful:', response);
                        var user = response.data || response;
                        
                        // Clear Jellyfin auth credentials (keep URL)
                        storage.removeJellyseerrUserSetting(auth.userId, 'jellyfinUsername');
                        storage.removeJellyseerrUserSetting(auth.userId, 'jellyfinPassword');
                        
                        // Reinitialize API to ensure session is active
                        initializeJellyseerr().then(function() {
                            showAlert('Successfully logged in to Jellyseerr as ' + user.displayName, 'Success');
                            updateSettingValues();
                            closeJellyseerrLocalModal();
                        }).catch(function(error) {
                            showAlert('Login succeeded but failed to initialize session. Please try again.', 'Warning');
                            closeJellyseerrLocalModal();
                        });
                    })
                    .catch(function(error) {
                        console.error('[Settings] Local login failed:', error);
                        showAlert('Failed to login. Please check your credentials and try again.', 'Login Failed');
                        inputs[1].value = '';
                        inputs[1].focus();
                    });
            },
            onCancel: closeJellyseerrLocalModal
        });
    }
    
    /**
     * Close Jellyseerr local account modal
     * @private
     */
    function closeJellyseerrLocalModal() {
        ModalManager.close('jellyseerrLocalModal');
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

    /**
     * Test connection to Jellyseerr server
     * @private
     */
    function testJellyseerrConnection() {
        if (!settings.jellyseerrUrl) {
            showAlert('Please set Jellyseerr URL first', 'Error');
            return;
        }
        
        // Initialize with the URL
        var auth = JellyfinAPI.getStoredAuth();
        var userId = auth && auth.userId ? auth.userId : null;
        
        JellyseerrAPI.initialize(settings.jellyseerrUrl, null, userId)
            .then(function() {
                return JellyseerrAPI.getStatus();
            })
            .then(function(status) {
                var message = 'Connection successful!\n\n' +
                    'Version: ' + (status.version || 'Unknown') + '\n' +
                    'Status: ' + (status.status || 'Online');
                showAlert(message, 'Connection Test');
            })
            .catch(function(error) {
                showAlert('Connection failed. Please check the URL and ensure Jellyseerr is running.\n\nError: ' + (error.message || error), 'Connection Failed');
            });
    }

    /**
     * Clear Jellyseerr cache and stored data
     * @private
     */
    function clearJellyseerrCache() {
        var returnFocus = document.querySelector('[data-setting="clearJellyseerrCache"]');
        
        showConfirm(
            'Clear all Jellyseerr cached data? This will not affect your server settings.',
            'Clear Cache',
            function() {
                try {
                    JellyseerrPreferences.clearCache();
                    showAlert('Jellyseerr cache cleared successfully', 'Success');
                    if (returnFocus) returnFocus.focus();
                } catch (error) {
                    showAlert('Failed to clear cache', 'Error');
                    if (returnFocus) returnFocus.focus();
                }
            },
            function() {
                if (returnFocus) returnFocus.focus();
            }
        );
    }

    /**
     * Disconnect current user from Jellyseerr
     * Logs out the current user without affecting other users or global settings
     * @private
     */
    function disconnectJellyseerr() {
        var returnFocus = document.querySelector('[data-setting="disconnectJellyseerr"]');
        
        showConfirm(
            'Disconnect from Jellyseerr? You will need to re-authenticate to use Jellyseerr features.',
            'Disconnect',
            function() {
                try {
                    JellyseerrAPI.logout();
                    showAlert('Successfully disconnected from Jellyseerr', 'Success');
                    if (returnFocus) returnFocus.focus();
                } catch (error) {
                    showAlert('Disconnected from Jellyseerr (with errors)', 'Warning');
                    if (returnFocus) returnFocus.focus();
                }
            },
            function() {
                if (returnFocus) returnFocus.focus();
            }
        );
    }

    /**
     * Show custom alert modal with D-pad support
     * @param {string} message - Alert message to display
     * @param {string} [title='Alert'] - Alert title
     * @private
     */
    function showAlert(message, title) {
        var modal = document.getElementById('customAlertModal');
        var titleElement = document.getElementById('alertTitle');
        var messageElement = document.getElementById('alertMessage');
        var okBtn = document.getElementById('alertOkBtn');
        
        if (!modal || !titleElement || !messageElement || !okBtn) return;
        
        titleElement.textContent = title || 'Alert';
        messageElement.textContent = message;
        modal.style.display = 'flex';
        
        setTimeout(function() {
            okBtn.focus();
        }, 100);
    }

    /**
     * Close custom alert modal
     * @private
     */
    function closeAlert() {
        var modal = document.getElementById('customAlertModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Show custom confirmation modal with D-pad support and remote navigation
     * Handles LEFT/RIGHT navigation between buttons and BACK key to cancel
     * @param {string} message - Confirmation message to display
     * @param {string} [title='Confirm Action'] - Confirmation title
     * @param {Function} onConfirm - Callback when confirmed
     * @param {Function} onCancel - Callback when cancelled
     * @private
     */
    function showConfirm(message, title, onConfirm, onCancel) {
        var modal = document.getElementById('confirmModal');
        var titleElement = document.getElementById('confirmTitle');
        var messageElement = document.getElementById('confirmMessage');
        var okBtn = document.getElementById('confirmOkBtn');
        var cancelBtn = document.getElementById('confirmCancelBtn');
        
        if (!modal || !titleElement || !messageElement || !okBtn || !cancelBtn) return;
        
        titleElement.textContent = title || 'Confirm Action';
        messageElement.textContent = message;
        modal.style.display = 'flex';
        
        // Remove any existing listeners
        var newOkBtn = okBtn.cloneNode(true);
        var newCancelBtn = cancelBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        // Add new listeners
        newOkBtn.addEventListener('click', function() {
            closeConfirm();
            if (onConfirm) onConfirm();
        });
        
        newCancelBtn.addEventListener('click', function() {
            closeConfirm();
            if (onCancel) onCancel();
        });
        
        // Handle keyboard navigation within modal
        var modalKeyHandler = function(evt) {
            if (evt.keyCode === KeyCodes.BACK) {
                evt.preventDefault();
                closeConfirm();
                if (onCancel) onCancel();
                modal.removeEventListener('keydown', modalKeyHandler);
            } else if (evt.keyCode === KeyCodes.LEFT || evt.keyCode === KeyCodes.RIGHT) {
                evt.preventDefault();
                if (document.activeElement === newOkBtn) {
                    newCancelBtn.focus();
                } else {
                    newOkBtn.focus();
                }
            }
        };
        
        modal.addEventListener('keydown', modalKeyHandler);
        
        setTimeout(function() {
            newCancelBtn.focus();
        }, 100);
    }

    /**
     * Close custom confirmation modal
     * @private
     */
    function closeConfirm() {
        var modal = document.getElementById('confirmModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Helper function to handle modal field navigation with UP/DOWN keys
     * @param {KeyboardEvent} evt - Keyboard event
     * @param {HTMLElement[]} fields - Array of focusable fields in order
     * @returns {boolean} True if navigation was handled
     * @private
     */
    function handleModalFieldNavigation(evt, fields) {
        if (evt.keyCode !== KeyCodes.UP && evt.keyCode !== KeyCodes.DOWN && 
            evt.keyCode !== KeyCodes.LEFT && evt.keyCode !== KeyCodes.RIGHT) {
            return false;
        }
        
        var activeElement = document.activeElement;
        var currentIndex = fields.indexOf(activeElement);
        
        if (currentIndex === -1) return false;
        
        // Handle UP/DOWN for all fields
        if (evt.keyCode === KeyCodes.UP || evt.keyCode === KeyCodes.DOWN) {
            evt.preventDefault();
            var newIndex = evt.keyCode === KeyCodes.UP ? currentIndex - 1 : currentIndex + 1;
            if (newIndex >= 0 && newIndex < fields.length) {
                fields[newIndex].focus();
            }
            return true;
        }
        
        // Handle LEFT/RIGHT only for buttons in modal-actions
        var currentField = fields[currentIndex];
        if (currentField.classList.contains('modal-btn') || 
            (currentField.parentElement && currentField.parentElement.classList.contains('modal-actions'))) {
            
            if (evt.keyCode === KeyCodes.LEFT || evt.keyCode === KeyCodes.RIGHT) {
                evt.preventDefault();
                
                // Find buttons in modal-actions
                var buttons = [];
                for (var i = 0; i < fields.length; i++) {
                    if (fields[i].classList.contains('modal-btn') || 
                        (fields[i].parentElement && fields[i].parentElement.classList.contains('modal-actions'))) {
                        buttons.push(fields[i]);
                    }
                }
                
                if (buttons.length > 1) {
                    var buttonIndex = buttons.indexOf(currentField);
                    var newButtonIndex = evt.keyCode === KeyCodes.LEFT ? buttonIndex - 1 : buttonIndex + 1;
                    
                    // Wrap around
                    if (newButtonIndex < 0) newButtonIndex = buttons.length - 1;
                    if (newButtonIndex >= buttons.length) newButtonIndex = 0;
                    
                    buttons[newButtonIndex].focus();
                }
                return true;
            }
        }
        
        return false;
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
