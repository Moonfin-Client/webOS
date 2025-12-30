/**
 * Library Controller
 * Handles library grid navigation, filtering, and item selection
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
        itemType: null
    },
    inNavBar: false,
    navBarIndex: 0,
    currentAuth: null,
    elements: {
        loading: null,
        itemGrid: null,
        errorDisplay: null,
        libraryTitle: null
    },

    init: function() {
        var urlParams = new URLSearchParams(window.location.search);
        this.libraryId = urlParams.get('id');
        this.serverId = urlParams.get('serverId');
        
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
            var checkNavbar = setInterval(function() {
                if (document.getElementById('homeBtn')) {
                    clearInterval(checkNavbar);
                    initLibrary();
                }
            }, 50);
        }
    },

    cacheElements: function() {
        this.elements.loading = document.getElementById('loading');
        this.elements.itemGrid = document.getElementById('item-grid');
        this.elements.errorDisplay = document.getElementById('error-display');
        this.elements.libraryTitle = document.getElementById('library-title');
    },

    setupEventListeners: function() {
        var self = this;
        document.addEventListener('keydown', function(e) { self.handleKeyDown(e); });

        var sortBtn = document.getElementById('sort-btn');
        var filterBtn = document.getElementById('filter-btn');

        if (sortBtn) {
            sortBtn.addEventListener('click', function() { self.showSortMenu(); });
            sortBtn.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) {
                    e.preventDefault();
                    self.showSortMenu();
                } else if (e.keyCode === KeyCodes.RIGHT) {
                    e.preventDefault();
                    if (filterBtn) filterBtn.focus();
                } else if (e.keyCode === KeyCodes.DOWN) {
                    e.preventDefault();
                    self.focusFirstGridItem();
                } else if (e.keyCode === KeyCodes.UP) {
                    e.preventDefault();
                    self.focusToNavBar();
                } else if (e.keyCode === KeyCodes.BACK) {
                    e.preventDefault();
                    e.stopPropagation();
                    window.history.back();
                }
            });
        }

        if (filterBtn) {
            filterBtn.addEventListener('click', function() { self.showFilterMenu(); });
            filterBtn.addEventListener('keydown', function(e) {
                if (e.keyCode === KeyCodes.ENTER) {
                    e.preventDefault();
                    self.showFilterMenu();
                } else if (e.keyCode === KeyCodes.LEFT) {
                    e.preventDefault();
                    if (sortBtn) sortBtn.focus();
                } else if (e.keyCode === KeyCodes.DOWN) {
                    e.preventDefault();
                    self.focusFirstGridItem();
                } else if (e.keyCode === KeyCodes.UP) {
                    e.preventDefault();
                    self.focusToNavBar();
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
    updateColumns: function() {
        var width = window.innerWidth;
        if (width >= 1920) {
            this.columns = 7;
        } else if (width >= 1600) {
            this.columns = 6;
        } else {
            this.columns = 5;
        }
    },

    loadLibrary: function() {
        var self = this;
        self.showLoading();

        var auth = typeof MultiServerManager !== 'undefined' 
            ? MultiServerManager.getAuthForPage() 
            : JellyfinAPI.getStoredAuth();
        
        if (!auth) {
            self.showError('Not authenticated');
            return;
        }
        
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

            var library = response.Items.find(function(item) { return item.Id === self.libraryId; });
            if (library) {
                self.libraryType = library.CollectionType;
                if (library.Name) {
                    self.libraryName = library.Name;
                    if (self.elements.libraryTitle) {
                        self.elements.libraryTitle.textContent = library.Name;
                    }
                }
            }

            var params = {
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

            var endpoint = '/Users/' + auth.userId + '/Items';
            JellyfinAPI.getItems(auth.serverAddress, auth.accessToken, endpoint, params, function(err, data) {
                if (err) {
                    self.showError('Failed to load library');
                    return;
                }

                if (!data || !data.Items) {
                    self.showError('Failed to load library items');
                    return;
                }
                
                var items = data.Items;
                if (library && (library.CollectionType === 'movies' || library.CollectionType === 'tvshows')) {
                    items = items.filter(function(item) { return item.Type !== 'BoxSet'; });
                }
                
                var uniqueItems = [];
                var seenIds = {};
                items.forEach(function(item) {
                    if (!seenIds[item.Id]) {
                        seenIds[item.Id] = true;
                        uniqueItems.push(item);
                    }
                });
                
                self.items = uniqueItems;
                if (self.items.length === 0) {
                    var hasActiveFilters = self.filters.isPlayed !== null || 
                                            self.filters.isFavorite !== null || 
                                            self.filters.itemType !== null;
                    if (hasActiveFilters) {
                        self.showEmptyFilteredResults();
                    } else {
                        self.showEmptyLibrary();
                    }
                } else {
                    self.displayItems();
                }
            });
        });
    },

    displayItems: function() {
        var self = this;
        if (!this.elements.itemGrid) {
            return;
        }
        
        this.elements.itemGrid.innerHTML = '';

        this.items.forEach(function(item, index) {
            var gridItem = self.createGridItem(item, index);
            self.elements.itemGrid.appendChild(gridItem);
        });

        this.hideLoading();

        if (this.items.length > 0) {
            if (this.currentIndex >= this.items.length) {
                this.currentIndex = 0;
            }
            setTimeout(function() {
                self.updateFocus();
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
    createGridItem: function(item, index) {
        var self = this;
        var auth = this.currentAuth || JellyfinAPI.getStoredAuth();
        var div = document.createElement('div');
        div.className = 'grid-item';
        div.setAttribute('data-index', index);
        div.setAttribute('tabindex', '0');
        
        // Check if this is a TV show series or collection
        var isSeries = item.Type === 'Series';
        var isBoxSet = item.Type === 'BoxSet';
        
        // Create image wrapper for positioning badges
        var imgWrapper = document.createElement('div');
        imgWrapper.className = 'item-image-wrapper';

        var img = document.createElement('img');
        img.className = 'item-image';
        img.alt = item.Name;
        img.loading = 'lazy';

        // Use ImageHelper for smart image selection
        var imageUrl = '';
        if (typeof ImageHelper !== 'undefined') {
            imageUrl = ImageHelper.getImageUrl(auth.serverAddress, item);
            
            // Apply aspect ratio class based on selected image type
            var aspect = ImageHelper.getAspectRatio(item, ImageHelper.getImageType());
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
        var itemCount = null;
        if (isSeries && item.RecursiveItemCount) {
            itemCount = item.RecursiveItemCount;
        } else if (isBoxSet && item.ChildCount) {
            itemCount = item.ChildCount;
        }
        
        if (itemCount) {
            var countBadge = document.createElement('div');
            countBadge.className = 'count-badge';
            var displayCount = itemCount > 99 ? '99+' : itemCount.toString();
            countBadge.textContent = displayCount;
            imgWrapper.appendChild(countBadge);
        }
        
        div.appendChild(imgWrapper);

        if (item.UserData && item.UserData.PlayedPercentage && item.UserData.PlayedPercentage > 0 && item.UserData.PlayedPercentage < 100) {
            var progressBar = document.createElement('div');
            progressBar.className = 'item-progress';
            var progressFill = document.createElement('div');
            progressFill.className = 'progress-fill';
            progressFill.style.width = item.UserData.PlayedPercentage + '%';
            progressBar.appendChild(progressFill);
            div.appendChild(progressBar);
        }

        // Add item info
        var info = document.createElement('div');
        info.className = 'item-info';
        
        var title = document.createElement('div');
        title.className = 'item-title';
        title.textContent = item.Name;
        info.appendChild(title);

        // Add additional info based on item type
        if (item.Type === 'Episode' && item.IndexNumber) {
            var subtitle = document.createElement('div');
            subtitle.className = 'item-subtitle';
            subtitle.textContent = 'Episode ' + item.IndexNumber;
            info.appendChild(subtitle);
        } else if (item.ProductionYear) {
            var subtitle = document.createElement('div');
            subtitle.className = 'item-subtitle';
            subtitle.textContent = item.ProductionYear;
            info.appendChild(subtitle);
        }

        div.appendChild(info);

        // Click handler
        div.addEventListener('click', function() { self.selectItem(index); });

        return div;
    },

    /**
     * Handle keyboard navigation in library grid
     * @param {KeyboardEvent} e - Keyboard event
     * @private
     */
    handleKeyDown: function(e) {
        var keyCode = e.keyCode;

        // Handle navbar navigation separately
        if (this.inNavBar) {
            this.handleNavBarNavigation(e);
            return;
        }

        // Don't handle if focus is on filter buttons (they have their own handlers)
        var activeElement = document.activeElement;
        if (activeElement && (activeElement.id === 'sort-btn' || activeElement.id === 'filter-btn')) {
            return;
        }

        if (this.items.length === 0) return;

        var row = Math.floor(this.currentIndex / this.columns);
        var col = this.currentIndex % this.columns;

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
                var newIndexUp = this.currentIndex - this.columns;
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
                var newIndexDown = this.currentIndex + this.columns;
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
    updateFocus: function() {
        var self = this;
        var items = document.querySelectorAll('.grid-item');
        items.forEach(function(item, index) {
            if (index === self.currentIndex) {
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
    selectItem: function(index) {
        var item = this.items[index];
        if (!item) return;

        // Navigate to details page, include serverId if present
        var url = 'details.html?id=' + item.Id;
        if (this.serverId) {
            url += '&serverId=' + this.serverId;
        }
        window.location.href = url;
    },

    /**
     * Show sort menu modal
     * @private
     */
    showSortMenu: function() {
        var self = this;
        // Different sort options based on library type
        var sortOptions;
        
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
        var currentIndex = sortOptions.findIndex(function(opt) {
            return opt.by === self.sortBy && opt.order === self.sortOrder;
        });
        
        // Move to next option (cycle)
        currentIndex = (currentIndex + 1) % sortOptions.length;
        var nextSort = sortOptions[currentIndex];
        
        this.sortBy = nextSort.by;
        this.sortOrder = nextSort.order;
        
        // Update button label to show current sort
        var sortBtn = document.getElementById('sort-btn');
        if (sortBtn) {
            var label = sortBtn.querySelector('.filter-label');
            if (label) label.textContent = 'Sort: ' + nextSort.label;
        }
        
        // Reload library with new sort
        this.loadLibrary();
    },

    /**
     * Show filter menu modal
     * @private
     */
    showFilterMenu: function() {
        var self = this;
        // Different filter options based on library type
        var filterStates;
        
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
            var currentIndex = filterStates.findIndex(function(f) {
                return f.isPlayed === self.filters.isPlayed && 
                    f.isFavorite === self.filters.isFavorite &&
                    f.itemType === self.filters.itemType;
            });
            
            // Move to next filter (cycle)
            currentIndex = (currentIndex + 1) % filterStates.length;
            var nextFilter = filterStates[currentIndex];
            
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
            var currentIndex = filterStates.findIndex(function(f) {
                return f.isPlayed === self.filters.isPlayed && f.isFavorite === self.filters.isFavorite;
            });
            
            // Move to next filter (cycle)
            currentIndex = (currentIndex + 1) % filterStates.length;
            var nextFilter = filterStates[currentIndex];
            
            this.filters.isPlayed = nextFilter.isPlayed;
            this.filters.isFavorite = nextFilter.isFavorite;
        }
        
        // Update button label to show current filter
        var filterBtn = document.getElementById('filter-btn');
        if (filterBtn) {
            var label = filterBtn.querySelector('.filter-label');
            // Find the label from the current state
            var currentState = this.libraryType === 'music' ? 
                filterStates.find(function(f) {
                    return f.isPlayed === self.filters.isPlayed && 
                    f.isFavorite === self.filters.isFavorite &&
                    f.itemType === self.filters.itemType;
                }) :
                filterStates.find(function(f) {
                    return f.isPlayed === self.filters.isPlayed && 
                    f.isFavorite === self.filters.isFavorite;
                });
            if (label && currentState) label.textContent = 'Filter: ' + currentState.label;
        }
        
        // Reload library with new filter
        this.loadLibrary();
    },

    /**
     * Show loading indicator, hide grid and errors
     * @private
     */
    showLoading: function() {
        if (this.elements.loading) this.elements.loading.style.display = 'flex';
        if (this.elements.errorDisplay) this.elements.errorDisplay.style.display = 'none';
        if (this.elements.itemGrid) this.elements.itemGrid.style.display = 'none';
    },

    hideLoading: function() {
        if (this.elements.loading) this.elements.loading.style.display = 'none';
        if (this.elements.itemGrid) this.elements.itemGrid.style.display = 'flex';
    },

    /**
     * Show error message, hide loading and grid
     * @param {string} message - Error message to display
     * @private
     */
    showError: function(message) {
        if (this.elements.loading) this.elements.loading.style.display = 'none';
        if (this.elements.itemGrid) this.elements.itemGrid.style.display = 'none';
        if (this.elements.errorDisplay) {
            this.elements.errorDisplay.style.display = 'flex';
            var errorMessage = this.elements.errorDisplay.querySelector('p');
            if (errorMessage) errorMessage.textContent = message;
        }
    },
    /**
     * Show inline message for empty filtered results
     * @private
     */
    showEmptyFilteredResults: function() {
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
            this.elements.itemGrid.innerHTML = '<div style="text-align: center; color: #aaa;">' +
                '<h3 style="font-size: 28px; margin-bottom: 16px; color: #fff;">No Items Found</h3>' +
                '<p style="font-size: 18px; margin-bottom: 24px;">No items match the current filter.</p>' +
                '<p style="font-size: 16px; opacity: 0.7;">Try changing the filter or sort options above.</p>' +
                '</div>';
        }
        
        // Focus back to filter button so user can easily change filter
        var filterBtn = document.getElementById('filter-btn');
        if (filterBtn) {
            setTimeout(function() { filterBtn.focus(); }, 100);
        }
    },

    showEmptyLibrary: function() {
        // Hide loading and grid
        if (this.elements.loading) this.elements.loading.style.display = 'none';
        if (this.elements.itemGrid) this.elements.itemGrid.style.display = 'none';
        if (this.elements.errorDisplay) this.elements.errorDisplay.style.display = 'none';
        
        // Create popup overlay
        var overlay = document.createElement('div');
        overlay.className = 'popup-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
        
        var popup = document.createElement('div');
        popup.className = 'popup';
        popup.style.cssText = 'background: #1a1a1a; padding: 40px; border-radius: 8px; text-align: center; max-width: 500px;';
        
        var message = document.createElement('h2');
        message.textContent = 'Library is Empty';
        message.style.cssText = 'color: #fff; margin-bottom: 20px; font-size: 32px;';
        
        var description = document.createElement('p');
        description.textContent = 'This library does not contain any items yet.';
        description.style.cssText = 'color: #aaa; margin-bottom: 30px; font-size: 18px;';
        
        var button = document.createElement('button');
        button.textContent = 'Go Back';
        button.className = 'btn-primary';
        button.style.cssText = 'background: #6440fb; color: #fff; border: none; padding: 12px 40px; border-radius: 4px; font-size: 18px; cursor: pointer;';
        button.setAttribute('tabindex', '0');
        
        var handleClose = function() {
            window.history.back();
        };
        
        button.addEventListener('click', handleClose);
        button.focus();
        
        // Handle keyboard
        var handleKeyDown = function(e) {
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
    getNavButtons: function() {
        return Array.from(document.querySelectorAll('.nav-left .nav-btn, .nav-center .nav-btn')).filter(function(btn) {
            return btn.offsetParent !== null; // Only include visible buttons
        });
    },

    /**     * Focus to the filter bar
     * @private
     */
    focusToFilterBar: function() {
        var sortBtn = document.getElementById('sort-btn');
        if (sortBtn) {
            sortBtn.focus();
        }
    },

    /**
     * Focus to the first grid item
     * @private
     */
    focusFirstGridItem: function() {
        if (this.items.length > 0) {
            this.currentIndex = 0;
            this.updateFocus();
        }
    },

    /**     * Move focus from grid to navbar
     * @private
     */
    focusToNavBar: function() {
        this.inNavBar = true;
        var navButtons = this.getNavButtons();
        
        // Start at home button (index 1), not user avatar (index 0)
        this.navBarIndex = navButtons.length > 1 ? 1 : 0;
        
        if (navButtons.length > 0) {
            navButtons.forEach(function(btn) { btn.classList.remove('focused'); });
            navButtons[this.navBarIndex].classList.add('focused');
            navButtons[this.navBarIndex].focus();
        }
    },

    /**
     * Move focus from navbar back to grid
     * @private
     */
    focusToGrid: function() {
        this.inNavBar = false;
        var navButtons = this.getNavButtons();
        navButtons.forEach(function(btn) { btn.classList.remove('focused'); });
        this.updateFocus();
    },

    /**
     * Handle keyboard navigation within navbar
     * @param {KeyboardEvent} e - Keyboard event
     * @private
     */
    handleNavBarNavigation: function(e) {
        var navButtons = this.getNavButtons();
        
        navButtons.forEach(function(btn) { btn.classList.remove('focused'); });
        
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
                var currentBtn = navButtons[this.navBarIndex];
                if (currentBtn) {
                    currentBtn.click();
                }
                break;
        }
    }
};

window.addEventListener('load', function() {
    LibraryController.init();
});
