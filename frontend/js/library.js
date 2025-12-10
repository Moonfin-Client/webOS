// Library Grid Controller
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

    init() {
        // Get library ID from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        this.libraryId = urlParams.get('id');
        
        if (!this.libraryId) {
            this.showError('No library ID provided');
            return;
        }

        // Load navbar
        const self = this;
        const initLibrary = function() {
            // Set up event listeners
            self.setupEventListeners();

            // Calculate columns based on viewport
            self.updateColumns();
            window.addEventListener('resize', () => self.updateColumns());

            // Load library items
            self.loadLibrary();
        };

        // Check if navbar is already loaded
        if (document.getElementById('homeBtn')) {
            initLibrary();
        } else {
            // Wait for navbar to load
            const checkNavbar = setInterval(function() {
                if (document.getElementById('homeBtn')) {
                    clearInterval(checkNavbar);
                    initLibrary();
                }
            }, 50);
        }
    },

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

    loadLibrary() {
        const self = this;
        self.showLoading();

        const auth = JellyfinAPI.getStoredAuth();
        if (!auth) {
            self.showError('Not authenticated');
            return;
        }

        // Get library details first
        JellyfinAPI.getUserViews(auth.serverAddress, auth.userId, auth.accessToken, function(err, response) {
            if (err || !response || !response.Items) {
                self.showError('Failed to load library details');
                return;
            }

            // Find the library in the views
            const library = response.Items.find(item => item.Id === self.libraryId);
            if (library && library.Name) {
                self.libraryName = library.Name;
                document.getElementById('library-title').textContent = library.Name;
            }

            // Build query parameters
            const params = {
                SortBy: self.sortBy,
                SortOrder: self.sortOrder,
                Fields: 'PrimaryImageAspectRatio,BasicSyncInfo',
                ImageTypeLimit: 1,
                EnableImageTypes: 'Primary,Backdrop,Thumb',
                Limit: 300
            };

            // Check if this is a boxsets/collections view
            if (library && library.CollectionType === 'boxsets') {
                // For collections, query BoxSets type
                params.IncludeItemTypes = 'BoxSet';
                params.Recursive = true;
            } else {
                // For regular libraries, use ParentId
                params.ParentId = self.libraryId;
                params.Recursive = true;
            }

            // Apply filters
            if (self.filters.isPlayed !== null) {
                params.IsPlayed = self.filters.isPlayed;
            }
            if (self.filters.isFavorite !== null) {
                params.IsFavorite = self.filters.isFavorite;
            }

            // Load items
            const endpoint = '/Users/' + auth.userId + '/Items';
            JellyfinAPI.getItems(auth.serverAddress, auth.accessToken, endpoint, params, function(err, data) {
                if (err) {
                    self.showError('Failed to load library');
                    return;
                }

                if (data && data.Items) {
                    self.items = data.Items;
                    if (self.items.length === 0) {
                        self.showEmptyLibrary();
                    } else {
                        self.displayItems();
                    }
                } else {
                    self.showError('Failed to load library items');
                }
            });
        });
    },

    displayItems() {
        const grid = document.getElementById('item-grid');
        grid.innerHTML = '';

        this.items.forEach((item, index) => {
            const gridItem = this.createGridItem(item, index);
            grid.appendChild(gridItem);
        });

        this.hideLoading();

        // Focus first item
        if (this.items.length > 0) {
            this.updateFocus();
        }
    },

    createGridItem(item, index) {
        const auth = JellyfinAPI.getStoredAuth();
        const div = document.createElement('div');
        div.className = 'grid-item';
        div.setAttribute('data-index', index);
        div.setAttribute('tabindex', '0');

        // Create image element
        const img = document.createElement('img');
        img.className = 'item-image';
        img.alt = item.Name;
        img.loading = 'lazy';

        // Always use Primary image for vertical posters
        if (item.ImageTags && item.ImageTags.Primary) {
            img.src = auth.serverAddress + '/Items/' + item.Id + '/Images/Primary?quality=90&maxHeight=400&tag=' + item.ImageTags.Primary;
        } else if (item.Type === 'Episode' && item.SeriesId && item.SeriesPrimaryImageTag) {
            img.src = auth.serverAddress + '/Items/' + item.SeriesId + '/Images/Primary?quality=90&maxHeight=400&tag=' + item.SeriesPrimaryImageTag;
        } else {
            img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"%3E%3Crect width="200" height="300" fill="%23333"/%3E%3C/svg%3E';
        }

        div.appendChild(img);

        // Add progress bar if partially watched
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

    handleKeyDown(e) {
        const keyCode = e.keyCode;

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

    updateFocus() {
        const items = document.querySelectorAll('.grid-item');
        items.forEach((item, index) => {
            if (index === this.currentIndex) {
                item.focus();
                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    },

    selectItem(index) {
        const item = this.items[index];
        if (!item) return;

        // Navigate to details page
        window.location.href = `details.html?id=${item.Id}`;
    },

    showSortMenu() {
        // TODO: Implement sort menu
    },

    showFilterMenu() {
        // TODO: Implement filter menu
    },

    showLoading() {
        document.getElementById('loading').style.display = 'flex';
        document.getElementById('error-display').style.display = 'none';
        document.getElementById('item-grid').style.display = 'none';
    },

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('item-grid').style.display = 'grid';
    },

    showError(message) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('item-grid').style.display = 'none';
        const errorDisplay = document.getElementById('error-display');
        errorDisplay.style.display = 'flex';
        errorDisplay.querySelector('p').textContent = message;
    },

    showEmptyLibrary() {
        // Hide loading and grid
        document.getElementById('loading').style.display = 'none';
        document.getElementById('item-grid').style.display = 'none';
        document.getElementById('error-display').style.display = 'none';
        
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
    }
};

// Initialize on page load
window.addEventListener('load', () => {
    LibraryController.init();
});
