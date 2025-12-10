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
        currentCategory: 'general'
    };

    var elements = {};

    var settings = {
        autoLogin: false,
        clockDisplay: '12-hour',
        maxBitrate: 'auto',
        skipIntro: true,
        autoPlay: true,
        audioLanguage: 'en',
        subtitleLanguage: 'none',
        theme: 'dark',
        carouselSpeed: 8000
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
            } catch (e) {
                JellyfinAPI.Logger.error('Failed to parse settings:', e);
            }
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
        
        if (evt.keyCode === KeyCodes.BACK) {
            evt.preventDefault();
            if (!focusManager.inSidebar && !focusManager.inNavBar) {
                focusToSidebar();
            } else if (focusManager.inSidebar) {
                focusToNavBar();
            } else if (focusManager.inNavBar) {
                window.location.href = 'browse.html';
            }
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
                    updateSidebarFocus();
                } else {
                    focusToNavBar();
                }
                break;
                
            case KeyCodes.DOWN: // Down
                evt.preventDefault();
                if (focusManager.sidebarIndex < categories.length - 1) {
                    focusManager.sidebarIndex++;
                    updateSidebarFocus();
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
            case 'autoLogin':
                settings.autoLogin = !settings.autoLogin;
                saveSettings();
                updateSettingValues();
                
                var message = settings.autoLogin ? 
                    'Auto-login enabled. You will be automatically logged in on app start.' : 
                    'Auto-login disabled. You will need to login manually.';
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
                
            case 'logout':
                handleLogout();
                break;
                
            case 'clearCache':
                handleClearCache();
                break;
                
            default:
                JellyfinAPI.Logger.warn('Setting not implemented:', settingName);
        }
    }

    function handleLogout() {
        JellyfinAPI.logout();
        window.location.href = 'login.html';
    }

    return {
        init: init
    };
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', SettingsController.init);
} else {
    SettingsController.init();
}
