const LibraryController = {
    libraryId: null,
    libraryName: null,
    items: [],
    currentIndex: 0,
    columns: 7,
    sortBy: 'SortName',
    sortOrder: 'Ascending',
    filters: {
        isPlayed: null,
        isFavorite: null
    },
    inNavBar: false,
    navBarIndex: 0,
    elements: {
        loading: null,
        itemGrid: null,
        errorDisplay: null,
        libraryTitle: null
    },

    /**
     * Initialize the library controller
     * Gets library ID from URL, caches elements, and loads library items
     */
    init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.libraryId = urlParams.get('id');
        
        if (!this.libraryId) {
            this.showError('No library ID provided');
            return;
        }

        const self = this;
        const initLibrary = function() {
            self.cacheElements();
            self.setupEventListeners();
            self.updateColumns();
            window.addEventListener('resize', () => self.updateColumns());
            self.loadLibrary();
        };

        if (document.getElementById('homeBtn')) {
            initLibrary();
        } else {
            const checkNavbar = setInterval(function() {
                if (document.getElementById('homeBtn')) {
                    clearInterval(checkNavbar);
                    initLibrary();
                }
            }, 50);
        }
    },

    /**
     * Cache frequently accessed DOM elements for better performance
     */
    cacheElements() {
        this.elements.loading = document.getElementById('loading');
        this.elements.itemGrid = document.getElementById('item-grid');
        this.elements.errorDisplay = document.getElementById('error-display');
        this.elements.libraryTitle = document.getElementById('library-title');
    },

    /**
     * Set up keyboard and click event listeners
     */
    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Filter buttons
        const sortBtn = document.getElementById('sort-btn');
        const filterBtn = document.getElementById('filter-btn');

        if (sortBtn) {
            sortBtn.addEventListener('click', () => this.showSortMenu());
        }

        if (filterBtn) {
            filterBtn.addEventListener('click', () => this.showFilterMenu());
        }
    },

    /**
     * Update grid column count based on viewport width
     * @private
     */
    updateColumns() {
        const width = window.innerWidth;
        if (width >= 1920) {
            this.columns = 7;
        } else if (width >= 1600) {
            this.columns = 6;
        } else {
            this.columns = 5;
        }
    },

    /**
     * Load library items from Jellyfin server
     * Fetches library details and items, then displays them in grid
     */
    loadLibrary() {
        const self = this;
        self.showLoading();

        const auth = JellyfinAPI.getStoredAuth();
        if (!auth) {
            self.showError('Not authenticated');
            return;
        }

        JellyfinAPI.getUserViews(auth.serverAddress, auth.userId, auth.accessToken, function(err, response) {
            if (err) {
                JellyfinAPI.Logger.error('Failed to load library details:', err);
                self.showError('Failed to load library details');
                return;
            }
            
            if (!response || !response.Items) {
                JellyfinAPI.Logger.error('No library data returned');
                self.showError('Failed to load library details');
                return;
            }

            const library = response.Items.find(item => item.Id === self.libraryId);
            if (library && library.Name) {
                self.libraryName = library.Name;
                if (self.elements.libraryTitle) {
                    self.elements.libraryTitle.textContent = library.Name;
                }
            }

            const params = {
                SortBy: self.sortBy,
                SortOrder: self.sortOrder,
                Fields: 'PrimaryImageAspectRatio,BasicSyncInfo',
                ImageTypeLimit: 1,
                EnableImageTypes: 'Primary,Backdrop,Thumb',
                Limit: 300
            };

            if (library && library.CollectionType === 'boxsets') {
                params.IncludeItemTypes = 'BoxSet';
                params.Recursive = true;
            } else if (library && library.CollectionType === 'tvshows') {
                params.IncludeItemTypes = 'Series';
                params.ParentId = self.libraryId;
                params.Recursive = true;
            } else if (library && library.CollectionType === 'movies') {
                params.IncludeItemTypes = 'Movie';
                params.ParentId = self.libraryId;
                params.Recursive = true;
            } else {
                params.ParentId = self.libraryId;
                params.Recursive = true;
            }
            if (self.filters.isPlayed !== null) {
                params.IsPlayed = self.filters.isPlayed;
            }
            if (self.filters.isFavorite !== null) {
                params.IsFavorite = self.filters.isFavorite;
            }

            const endpoint = '/Users/' + auth.userId + '/Items';
            JellyfinAPI.getItems(auth.serverAddress, auth.accessToken, endpoint, params, function(err, data) {
                if (err) {
                    JellyfinAPI.Logger.error('Failed to load library items:', err);
                    self.showError('Failed to load library');
                    return;
                }

                if (!data || !data.Items) {
                    JellyfinAPI.Logger.error('No library items returned');
                    self.showError('Failed to load library items');
                    return;
                }
                
                self.items = data.Items;
                if (self.items.length === 0) {
                    self.showEmptyLibrary();
                } else {
                    self.displayItems();
                }
            });
        });
    },

    /**
     * Display library items in the grid
     * Clears existing items and renders current item list
     * @private
     */
    displayItems() {
        if (!this.elements.itemGrid) return;
        
        this.elements.itemGrid.innerHTML = '';

        this.items.forEach((item, index) => {
            const gridItem = this.createGridItem(item, index);
            this.elements.itemGrid.appendChild(gridItem);
        });

        this.hideLoading();

        if (this.items.length > 0) {
            this.updateFocus();
        }
    },

    /**
     * Create a grid item element for a library item
     * @param {Object} item - Jellyfin item object
     * @param {number} index - Item index in the grid
     * @returns {HTMLElement} Grid item element
     * @private
     */
    createGridItem(item, index) {
        const auth = JellyfinAPI.getStoredAuth();
        const div = document.createElement('div');
        div.className = 'grid-item';
        div.setAttribute('data-index', index);
        div.setAttribute('tabindex', '0');

        const img = document.createElement('img');
        img.className = 'item-image';
        img.alt = item.Name;
        img.loading = 'lazy';

        if (item.ImageTags && item.ImageTags.Primary) {
            img.src = auth.serverAddress + '/Items/' + item.Id + '/Images/Primary?quality=90&maxHeight=400&tag=' + item.ImageTags.Primary;
        } else if (item.Type === 'Episode' && item.SeriesId && item.SeriesPrimaryImageTag) {
            img.src = auth.serverAddress + '/Items/' + item.SeriesId + '/Images/Primary?quality=90&maxHeight=400&tag=' + item.SeriesPrimaryImageTag;
        } else {
            img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"%3E%3Crect width="200" height="300" fill="%23333"/%3E%3C/svg%3E';
        }

        div.appendChild(img);

        if (item.UserData && item.UserData.PlayedPercentage && item.UserData.PlayedPercentage > 0 && item.UserData.PlayedPercentage < 100) {
            const progressBar = document.createElement('div');
            progressBar.className = 'item-progress';
            const progressFill = document.createElement('div');
            progressFill.className = 'progress-fill';
            progressFill.style.width = item.UserData.PlayedPercentage + '%';
            progressBar.appendChild(progressFill);
            div.appendChild(progressBar);
        }

        // Add item info
        const info = document.createElement('div');
        info.className = 'item-info';
        
        const title = document.createElement('div');
        title.className = 'item-title';
        title.textContent = item.Name;
        info.appendChild(title);

        // Add additional info based on item type
        if (item.Type === 'Episode' && item.IndexNumber) {
            const subtitle = document.createElement('div');
            subtitle.className = 'item-subtitle';
            subtitle.textContent = `Episode ${item.IndexNumber}`;
            info.appendChild(subtitle);
        } else if (item.ProductionYear) {
            const subtitle = document.createElement('div');
            subtitle.className = 'item-subtitle';
            subtitle.textContent = item.ProductionYear;
            info.appendChild(subtitle);
        }

        div.appendChild(info);

        // Click handler
        div.addEventListener('click', () => this.selectItem(index));

        return div;
    },

    /**
     * Handle keyboard navigation in library grid
     * @param {KeyboardEvent} e - Keyboard event
     * @private
     */
    handleKeyDown(e) {
        const keyCode = e.keyCode;

        // Handle navbar navigation separately
        if (this.inNavBar) {
            this.handleNavBarNavigation(e);
            return;
        }

        if (this.items.length === 0) return;

        const row = Math.floor(this.currentIndex / this.columns);
        const col = this.currentIndex % this.columns;

        switch (keyCode) {
            case KeyCodes.LEFT:
                e.preventDefault();
                if (col > 0) {
                    this.currentIndex--;
                    this.updateFocus();
                }
                break;

            case KeyCodes.RIGHT:
                e.preventDefault();
                if (col < this.columns - 1 && this.currentIndex < this.items.length - 1) {
                    this.currentIndex++;
                    this.updateFocus();
                }
                break;

            case KeyCodes.UP:
                e.preventDefault();
                const newIndexUp = this.currentIndex - this.columns;
                if (newIndexUp >= 0) {
                    this.currentIndex = newIndexUp;
                    this.updateFocus();
                } else if (row === 0) {
                    // At the first row, pressing UP focuses the navbar
                    this.focusToNavBar();
                }
                break;

            case KeyCodes.DOWN:
                e.preventDefault();
                const newIndexDown = this.currentIndex + this.columns;
                if (newIndexDown < this.items.length) {
                    this.currentIndex = newIndexDown;
                    this.updateFocus();
                }
                break;

            case KeyCodes.ENTER:
                e.preventDefault();
                this.selectItem(this.currentIndex);
                break;

            case KeyCodes.BACK:
                e.preventDefault();
                window.history.back();
                break;
        }
    },

    /**
     * Update focus to the current grid item
     * Scrolls item into view smoothly
     * @private
     */
    updateFocus() {
        const items = document.querySelectorAll('.grid-item');
        items.forEach((item, index) => {
            if (index === this.currentIndex) {
                item.focus();
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    },

    /**
     * Navigate to details page for selected item
     * @param {number} index - Index of item to select
     * @private
     */
    selectItem(index) {
        const item = this.items[index];
        if (!item) return;

        // Navigate to details page
        window.location.href = `details.html?id=${item.Id}`;
    },

    /**
     * Show loading indicator, hide grid and errors
     * @private
     */
    showLoading() {
        if (this.elements.loading) this.elements.loading.style.display = 'flex';
        if (this.elements.errorDisplay) this.elements.errorDisplay.style.display = 'none';
        if (this.elements.itemGrid) this.elements.itemGrid.style.display = 'none';
    },

    hideLoading() {
        if (this.elements.loading) this.elements.loading.style.display = 'none';
        if (this.elements.itemGrid) this.elements.itemGrid.style.display = 'grid';
    },

    /**
     * Show error message, hide loading and grid
     * @param {string} message - Error message to display
     * @private
     */
    showError(message) {
        JellyfinAPI.Logger.error(message);
        if (this.elements.loading) this.elements.loading.style.display = 'none';
        if (this.elements.itemGrid) this.elements.itemGrid.style.display = 'none';
        if (this.elements.errorDisplay) {
            this.elements.errorDisplay.style.display = 'flex';
            const errorMessage = this.elements.errorDisplay.querySelector('p');
            if (errorMessage) errorMessage.textContent = message;
        }
    },

    showEmptyLibrary() {
        // Hide loading and grid
        if (this.elements.loading) this.elements.loading.style.display = 'none';
        if (this.elements.itemGrid) this.elements.itemGrid.style.display = 'none';
        if (this.elements.errorDisplay) this.elements.errorDisplay.style.display = 'none';
        
        // Create popup overlay
        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
        
        const popup = document.createElement('div');
        popup.className = 'popup';
        popup.style.cssText = 'background: #1a1a1a; padding: 40px; border-radius: 8px; text-align: center; max-width: 500px;';
        
        const message = document.createElement('h2');
        message.textContent = 'Library is Empty';
        message.style.cssText = 'color: #fff; margin-bottom: 20px; font-size: 32px;';
        
        const description = document.createElement('p');
        description.textContent = 'This library does not contain any items yet.';
        description.style.cssText = 'color: #aaa; margin-bottom: 30px; font-size: 18px;';
        
        const button = document.createElement('button');
        button.textContent = 'Go Back';
        button.className = 'btn-primary';
        button.style.cssText = 'background: #6440fb; color: #fff; border: none; padding: 12px 40px; border-radius: 4px; font-size: 18px; cursor: pointer;';
        button.setAttribute('tabindex', '0');
        
        const handleClose = () => {
            window.history.back();
        };
        
        button.addEventListener('click', handleClose);
        button.focus();
        
        // Handle keyboard
        const handleKeyDown = (e) => {
            if (e.keyCode === KeyCodes.ENTER || e.keyCode === KeyCodes.BACK) {
                e.preventDefault();
                handleClose();
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        
        popup.appendChild(message);
        popup.appendChild(description);
        popup.appendChild(button);
        overlay.appendChild(popup);
        document.body.appendChild(overlay);
    },

    /**
     * Get all navbar button elements
     * @returns {HTMLElement[]} Array of navbar button elements
     * @private
     */
    getNavButtons() {
        return Array.from(document.querySelectorAll('.nav-left .nav-btn, .nav-center .nav-btn'));
    },

    /**
     * Move focus from grid to navbar
     * @private
     */
    focusToNavBar() {
        this.inNavBar = true;
        const navButtons = this.getNavButtons();
        
        // Start at home button (index 1), not user avatar (index 0)
        this.navBarIndex = navButtons.length > 1 ? 1 : 0;
        
        if (navButtons.length > 0) {
            navButtons.forEach(btn => btn.classList.remove('focused'));
            navButtons[this.navBarIndex].classList.add('focused');
            navButtons[this.navBarIndex].focus();
        }
    },

    /**
     * Move focus from navbar back to grid
     * @private
     */
    focusToGrid() {
        this.inNavBar = false;
        const navButtons = this.getNavButtons();
        navButtons.forEach(btn => btn.classList.remove('focused'));
        this.updateFocus();
    },

    /**
     * Handle keyboard navigation within navbar
     * @param {KeyboardEvent} e - Keyboard event
     * @private
     */
    handleNavBarNavigation(e) {
        const navButtons = this.getNavButtons();
        
        navButtons.forEach(btn => btn.classList.remove('focused'));
        
        switch (e.keyCode) {
            case KeyCodes.LEFT:
                e.preventDefault();
                if (this.navBarIndex > 0) {
                    this.navBarIndex--;
                }
                navButtons[this.navBarIndex].classList.add('focused');
                navButtons[this.navBarIndex].focus();
                break;
                
            case KeyCodes.RIGHT:
                e.preventDefault();
                if (this.navBarIndex < navButtons.length - 1) {
                    this.navBarIndex++;
                }
                navButtons[this.navBarIndex].classList.add('focused');
                navButtons[this.navBarIndex].focus();
                break;
                
            case KeyCodes.DOWN:
                e.preventDefault();
                this.focusToGrid();
                break;
                
            case KeyCodes.ENTER:
                e.preventDefault();
                const currentBtn = navButtons[this.navBarIndex];
                if (currentBtn) {
                    currentBtn.click();
                }
                break;
        }
    }
};

// Initialize on page load
window.addEventListener('load', () => {
    LibraryController.init();
});
