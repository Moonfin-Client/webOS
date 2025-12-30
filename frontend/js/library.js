/**
 * Library Controller
 * Handles library grid navigation, filtering, and item selection
 * @namespace LibraryController
 */
var LibraryController = {
    libraryId: null,
    libraryName: null,
    libraryType: null,
    items: [],
    currentIndex: 0,
    columns: 7,
    sortBy: 'SortName',
    sortOrder: 'Ascending',
    filters: {
        isPlayed: null,
        isFavorite: null,
        itemType: null  // For music: 'Album', 'Artist', 'Song'
    },
    inNavBar: false,
    navBarIndex: 0,
    currentAuth: null,  // Store auth for current library's server
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
    init: function() {
        var urlParams = new URLSearchParams(window.location.search);
        this.libraryId = urlParams.get('id');
        this.serverId = urlParams.get('serverId'); // Get server ID from URL if present
        
        if (!this.libraryId) {
            this.showError('No library ID provided');
            return;
        }

        var self = this;
        var initLibrary = function() {
            self.cacheElements();
            self.setupEventListeners();
            self.updateColumns();
            window.addEventListener('resize', function() { self.updateColumns(); });
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
            sortBtn.addEventListener('keydown', (e) => {
                if (e.keyCode === KeyCodes.ENTER) {
                    e.preventDefault();
                    this.showSortMenu();
                } else if (e.keyCode === KeyCodes.RIGHT) {
                    e.preventDefault();
                    if (filterBtn) filterBtn.focus();
                } else if (e.keyCode === KeyCodes.DOWN) {
                    e.preventDefault();
                    this.focusFirstGridItem();
                } else if (e.keyCode === KeyCodes.UP) {
                    e.preventDefault();
                    this.focusToNavBar();
                } else if (e.keyCode === KeyCodes.BACK) {
                    e.preventDefault();
                    e.stopPropagation();
                    window.history.back();
                }
            });
        }

        if (filterBtn) {
            filterBtn.addEventListener('click', () => this.showFilterMenu());
            filterBtn.addEventListener('keydown', (e) => {
                if (e.keyCode === KeyCodes.ENTER) {
                    e.preventDefault();
                    this.showFilterMenu();
                } else if (e.keyCode === KeyCodes.LEFT) {
                    e.preventDefault();
                    if (sortBtn) sortBtn.focus();
                } else if (e.keyCode === KeyCodes.DOWN) {
                    e.preventDefault();
                    this.focusFirstGridItem();
                } else if (e.keyCode === KeyCodes.UP) {
                    e.preventDefault();
                    this.focusToNavBar();
                } else if (e.keyCode === KeyCodes.BACK) {
                    e.preventDefault();
                    e.stopPropagation();
                    window.history.back();
                }
            });
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

        // Get auth for the specific server if serverId is provided
        let auth = typeof MultiServerManager !== 'undefined' 
            ? MultiServerManager.getAuthForPage() 
            : JellyfinAPI.getStoredAuth();
        
        if (!auth) {
            self.showError('Not authenticated');
            return;
        }
        
        // Store auth for use in createGridItem
        self.currentAuth = auth;

        JellyfinAPI.getUserViews(auth.serverAddress, auth.userId, auth.accessToken, function(err, response) {
            if (err) {
                self.showError('Failed to load library details');
                return;
            }
            
            if (!response || !response.Items) {
                self.showError('Failed to load library details');
                return;
            }

            const library = response.Items.find(function(item) { return item.Id === self.libraryId; });
            if (library) {
                self.libraryType = library.CollectionType;
                if (library.Name) {
                    self.libraryName = library.Name;
                    if (self.elements.libraryTitle) {
                        self.elements.libraryTitle.textContent = library.Name;
                    }
                }
            }

            const params = {
                SortBy: self.sortBy,
                SortOrder: self.sortOrder,
                Fields: 'PrimaryImageAspectRatio,BasicSyncInfo,ChildCount,RecursiveItemCount',
                ImageTypeLimit: 1,
                EnableImageTypes: 'Primary,Backdrop,Thumb',
                Limit: 300
            };

            if (library && library.CollectionType === 'boxsets') {
                params.IncludeItemTypes = 'BoxSet';
                params.ParentId = self.libraryId;
                params.Recursive = true;
            } else if (library && library.CollectionType === 'tvshows') {
                params.IncludeItemTypes = 'Series';
                params.ParentId = self.libraryId;
                params.Recursive = true;
            } else if (library && library.CollectionType === 'movies') {
                params.IncludeItemTypes = 'Movie';
                params.ParentId = self.libraryId;
                params.Recursive = true;
            } else if (library && library.CollectionType === 'music') {
                // For music, check what we're filtering for
                if (self.filters.itemType === 'Artist') {
                    params.IncludeItemTypes = 'MusicArtist';
                } else if (self.filters.itemType === 'Song') {
                    params.IncludeItemTypes = 'Audio';
                } else {
                    // Default: show all music items (albums, artists, songs)
                    params.IncludeItemTypes = 'MusicAlbum,MusicArtist,Audio';
                }
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
                    self.showError('Failed to load library');
                    return;
                }

                if (!data || !data.Items) {
                    self.showError('Failed to load library items');
                    return;
                }
                
                // Filter out BoxSets from movie and TV libraries (API doesn't always honor IncludeItemTypes)
                let items = data.Items;
                if (library && (library.CollectionType === 'movies' || library.CollectionType === 'tvshows')) {
                    items = items.filter(item => item.Type !== 'BoxSet');
                }
                
                // Remove duplicates based on ID (in case API returns duplicates)
                const uniqueItems = [];
                const seenIds = new Set();
                items.forEach(item => {
                    if (!seenIds.has(item.Id)) {
                        seenIds.add(item.Id);
                        uniqueItems.push(item);
                    }
                });
                
                self.items = uniqueItems;
                if (self.items.length === 0) {
                    // Check if we have active filters
                    const hasActiveFilters = self.filters.isPlayed !== null || 
                                            self.filters.isFavorite !== null || 
                                            self.filters.itemType !== null;
                    if (hasActiveFilters) {
                        // Show inline message for empty filtered results
                        self.showEmptyFilteredResults();
                    } else {
                        // Show popup for truly empty library
                        self.showEmptyLibrary();
                    }
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
            // Ensure currentIndex is valid
            if (this.currentIndex >= this.items.length) {
                this.currentIndex = 0;
            }
            // Set focus after a brief delay to ensure DOM is ready
            setTimeout(() => {
                this.updateFocus();
            }, 100);
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
        const auth = this.currentAuth || JellyfinAPI.getStoredAuth();
        const div = document.createElement('div');
        div.className = 'grid-item';
        div.setAttribute('data-index', index);
        div.setAttribute('tabindex', '0');
        
        // Check if this is a TV show series or collection
        const isSeries = item.Type === 'Series';
        const isBoxSet = item.Type === 'BoxSet';
        
        // Create image wrapper for positioning badges
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'item-image-wrapper';

        const img = document.createElement('img');
        img.className = 'item-image';
        img.alt = item.Name;
        img.loading = 'lazy';

        // Use ImageHelper for smart image selection
        let imageUrl = '';
        if (typeof ImageHelper !== 'undefined') {
            imageUrl = ImageHelper.getImageUrl(auth.serverAddress, item);
            
            // Apply aspect ratio class based on selected image type
            const aspect = ImageHelper.getAspectRatio(item, ImageHelper.getImageType());
            if (aspect > 1.5) {
                div.classList.add('landscape-card');
            } else if (aspect > 1.1) {
                div.classList.add('wide-card');
            } else {
                div.classList.add('portrait-card');
            }
            
            img.src = imageUrl || ImageHelper.getPlaceholderUrl(item);
        } else {
            // Fallback to old logic if ImageHelper not loaded
            if (item.ImageTags && item.ImageTags.Primary) {
                img.src = auth.serverAddress + '/Items/' + item.Id + '/Images/Primary?quality=90&maxHeight=400&tag=' + item.ImageTags.Primary;
            } else if (item.Type === 'Episode' && item.SeriesId && item.SeriesPrimaryImageTag) {
                img.src = auth.serverAddress + '/Items/' + item.SeriesId + '/Images/Primary?quality=90&maxHeight=400&tag=' + item.SeriesPrimaryImageTag;
            } else {
                img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"%3E%3Crect width="200" height="300" fill="%23333"/%3E%3C/svg%3E';
            }
        }

        imgWrapper.appendChild(img);
        
        // Add count badge for TV shows and collections
        // Series: Use RecursiveItemCount (episode count)
        // BoxSet: Use ChildCount (item count)
        let itemCount = null;
        if (isSeries && item.RecursiveItemCount) {
            itemCount = item.RecursiveItemCount;
        } else if (isBoxSet && item.ChildCount) {
            itemCount = item.ChildCount;
        }
        
        if (itemCount) {
            const countBadge = document.createElement('div');
            countBadge.className = 'count-badge';
            const displayCount = itemCount > 99 ? '99+' : itemCount.toString();
            countBadge.textContent = displayCount;
            imgWrapper.appendChild(countBadge);
        }
        
        div.appendChild(imgWrapper);

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
            subtitle.textContent = 'Episode ' + item.IndexNumber;
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

        // Don't handle if focus is on filter buttons (they have their own handlers)
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.id === 'sort-btn' || activeElement.id === 'filter-btn')) {
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
                    // At the first row, pressing UP focuses the filter buttons
                    this.focusToFilterBar();
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
                e.stopPropagation();
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

        // Navigate to details page, include serverId if present
        let url = 'details.html?id=' + item.Id;
        if (this.serverId) {
            url += '&serverId=' + this.serverId;
        }
        window.location.href = url;
    },

    /**
     * Show sort menu modal
     * @private
     */
    showSortMenu() {
        
        // Different sort options based on library type
        let sortOptions;
        
        if (this.libraryType === 'music') {
            sortOptions = [
                { by: 'SortName', order: 'Ascending', label: 'Name (A-Z)' },
                { by: 'SortName', order: 'Descending', label: 'Name (Z-A)' },
                { by: 'Album', order: 'Ascending', label: 'Album (A-Z)' },
                { by: 'Album', order: 'Descending', label: 'Album (Z-A)' },
                { by: 'AlbumArtist', order: 'Ascending', label: 'Artist (A-Z)' },
                { by: 'AlbumArtist', order: 'Descending', label: 'Artist (Z-A)' },
                { by: 'DateCreated', order: 'Descending', label: 'Date Added (Newest)' },
                { by: 'DateCreated', order: 'Ascending', label: 'Date Added (Oldest)' },
                { by: 'PremiereDate', order: 'Descending', label: 'Release Date (Newest)' },
                { by: 'PremiereDate', order: 'Ascending', label: 'Release Date (Oldest)' },
                { by: 'CommunityRating', order: 'Descending', label: 'Rating (Highest)' },
                { by: 'CommunityRating', order: 'Ascending', label: 'Rating (Lowest)' }
            ];
        } else {
            // Default options for movies/tv
            sortOptions = [
                { by: 'SortName', order: 'Ascending', label: 'Name (A-Z)' },
                { by: 'SortName', order: 'Descending', label: 'Name (Z-A)' },
                { by: 'DateCreated', order: 'Descending', label: 'Date Added (Newest)' },
                { by: 'DateCreated', order: 'Ascending', label: 'Date Added (Oldest)' },
                { by: 'PremiereDate', order: 'Descending', label: 'Release Date (Newest)' },
                { by: 'PremiereDate', order: 'Ascending', label: 'Release Date (Oldest)' }
            ];
        }
        
        // Find current sort index
        let currentIndex = sortOptions.findIndex(opt => 
            opt.by === this.sortBy && opt.order === this.sortOrder
        );
        
        // Move to next option (cycle)
        currentIndex = (currentIndex + 1) % sortOptions.length;
        const nextSort = sortOptions[currentIndex];
        
        this.sortBy = nextSort.by;
        this.sortOrder = nextSort.order;
        
        // Update button label to show current sort
        const sortBtn = document.getElementById('sort-btn');
        if (sortBtn) {
            const label = sortBtn.querySelector('.filter-label');
            if (label) label.textContent = 'Sort: ' + nextSort.label;
        }
        
        // Reload library with new sort
        this.loadLibrary();
    },

    /**
     * Show filter menu modal
     * @private
     */
    showFilterMenu() {
        
        // Different filter options based on library type
        let filterStates;
        
        if (this.libraryType === 'music') {
            filterStates = [
                { isPlayed: null, isFavorite: null, itemType: null, label: 'Albums' },
                { isPlayed: null, isFavorite: null, itemType: 'Artist', label: 'Artists' },
                { isPlayed: null, isFavorite: null, itemType: 'Song', label: 'Songs' },
                { isPlayed: null, isFavorite: true, itemType: null, label: 'Favorite Albums' },
                { isPlayed: null, isFavorite: true, itemType: 'Artist', label: 'Favorite Artists' },
                { isPlayed: null, isFavorite: true, itemType: 'Song', label: 'Favorite Songs' }
            ];
            
            // Find current filter index
            let currentIndex = filterStates.findIndex(f => 
                f.isPlayed === this.filters.isPlayed && 
                f.isFavorite === this.filters.isFavorite &&
                f.itemType === this.filters.itemType
            );
            
            // Move to next filter (cycle)
            currentIndex = (currentIndex + 1) % filterStates.length;
            const nextFilter = filterStates[currentIndex];
            
            this.filters.isPlayed = nextFilter.isPlayed;
            this.filters.isFavorite = nextFilter.isFavorite;
            this.filters.itemType = nextFilter.itemType;
        } else {
            // Default filters for movies/tv
            filterStates = [
                { isPlayed: null, isFavorite: null, label: 'All' },
                { isPlayed: false, isFavorite: null, label: 'Unplayed' },
                { isPlayed: true, isFavorite: null, label: 'Played' },
                { isPlayed: null, isFavorite: true, label: 'Favorites' }
            ];
            
            // Find current filter index
            let currentIndex = filterStates.findIndex(f => 
                f.isPlayed === this.filters.isPlayed && f.isFavorite === this.filters.isFavorite
            );
            
            // Move to next filter (cycle)
            currentIndex = (currentIndex + 1) % filterStates.length;
            const nextFilter = filterStates[currentIndex];
            
            this.filters.isPlayed = nextFilter.isPlayed;
            this.filters.isFavorite = nextFilter.isFavorite;
        }
        
        // Update button label to show current filter
        const filterBtn = document.getElementById('filter-btn');
        if (filterBtn) {
            const label = filterBtn.querySelector('.filter-label');
            // Find the label from the current state
            const currentState = this.libraryType === 'music' ? 
                filterStates.find(function(f) {
                    return f.isPlayed === this.filters.isPlayed && 
                    f.isFavorite === this.filters.isFavorite &&
                    f.itemType === this.filters.itemType;
                }.bind(this)) :
                filterStates.find(function(f) {
                    return f.isPlayed === this.filters.isPlayed && 
                    f.isFavorite === this.filters.isFavorite;
                }.bind(this));
            if (label && currentState) label.textContent = 'Filter: ' + currentState.label;
        }
        
        // Reload library with new filter
        this.loadLibrary();
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
        if (this.elements.loading) this.elements.loading.style.display = 'none';
        if (this.elements.itemGrid) this.elements.itemGrid.style.display = 'none';
        if (this.elements.errorDisplay) {
            this.elements.errorDisplay.style.display = 'flex';
            const errorMessage = this.elements.errorDisplay.querySelector('p');
            if (errorMessage) errorMessage.textContent = message;
        }
    },
    /**
     * Show inline message for empty filtered results
     * @private
     */
    showEmptyFilteredResults() {
        // Hide loading
        if (this.elements.loading) this.elements.loading.style.display = 'none';
        if (this.elements.errorDisplay) this.elements.errorDisplay.style.display = 'none';
        
        // Clear and show grid with message
        if (this.elements.itemGrid) {
            this.elements.itemGrid.style.display = 'flex';
            this.elements.itemGrid.style.flexDirection = 'column';
            this.elements.itemGrid.style.alignItems = 'center';
            this.elements.itemGrid.style.justifyContent = 'center';
            this.elements.itemGrid.style.padding = '60px 20px';
            this.elements.itemGrid.innerHTML = `
                <div style="text-align: center; color: #aaa;">
                    <h3 style="font-size: 28px; margin-bottom: 16px; color: #fff;">No Items Found</h3>
                    <p style="font-size: 18px; margin-bottom: 24px;">No items match the current filter.</p>
                    <p style="font-size: 16px; opacity: 0.7;">Try changing the filter or sort options above.</p>
                </div>
            `;
        }
        
        // Focus back to filter button so user can easily change filter
        const filterBtn = document.getElementById('filter-btn');
        if (filterBtn) {
            setTimeout(() => filterBtn.focus(), 100);
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
        return Array.from(document.querySelectorAll('.nav-left .nav-btn, .nav-center .nav-btn')).filter(function(btn) {
            return btn.offsetParent !== null; // Only include visible buttons
        });
    },

    /**     * Focus to the filter bar
     * @private
     */
    focusToFilterBar() {
        const sortBtn = document.getElementById('sort-btn');
        if (sortBtn) {
            sortBtn.focus();
        }
    },

    /**
     * Focus to the first grid item
     * @private
     */
    focusFirstGridItem() {
        if (this.items.length > 0) {
            this.currentIndex = 0;
            this.updateFocus();
        }
    },

    /**     * Move focus from grid to navbar
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
