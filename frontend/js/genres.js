(function() {
    'use strict';
    
    var auth;
    var genresData = {};
    
    function init() {
        
        auth = JellyfinAPI.getStoredAuth();
        if (!auth) {
            window.location.href = 'login.html';
            return;
        }
        
        storage.applyBackdropBlur(document.getElementById('globalBackdropImage'), 'backdropBlurHome', 20);
        loadGenres();
    }
    
    function loadGenres() {
        var loadingContainer = document.getElementById('loadingContainer');
        var genresContainer = document.getElementById('genresContainer');
        var errorMessage = document.getElementById('errorMessage');
        
        // Fetch all movies and TV shows (exclude BoxSets)
        var params = {
            userId: auth.userId,
            includeItemTypes: 'Movie,Series',
            filters: 'IsNotFolder',
            recursive: true,
            fields: 'Genres,PrimaryImageAspectRatio,ProductionYear',
            sortBy: 'SortName',
            sortOrder: 'Ascending',
            limit: 10000,
            excludeItemTypes: 'BoxSet'
        };
        
        JellyfinAPI.getItems(auth.serverAddress, auth.accessToken, '/Users/' + auth.userId + '/Items', params, function(err, data) {
            if (err || !data || !data.Items) {
                loadingContainer.style.display = 'none';
                errorMessage.textContent = 'Failed to load content';
                errorMessage.style.display = 'block';
                return;
            }
            
            
            // Group items by genre
            data.Items.forEach(function(item) {
                if (item.Genres && item.Genres.length > 0) {
                    item.Genres.forEach(function(genre) {
                        if (!genresData[genre]) {
                            genresData[genre] = [];
                        }
                        genresData[genre].push(item);
                    });
                }
            });
            
            // Sort genres alphabetically
            var sortedGenres = Object.keys(genresData).sort();
            
            if (sortedGenres.length === 0) {
                loadingContainer.style.display = 'none';
                errorMessage.textContent = 'No genres found';
                errorMessage.style.display = 'block';
                return;
            }
            
            
            // Render each genre as a row
            sortedGenres.forEach(function(genre) {
                renderGenreRow(genre, genresData[genre]);
            });
            
            loadingContainer.style.display = 'none';
            setupNavigation();
        });
    }
    
    function renderGenreRow(genre, items) {
        var genresContainer = document.getElementById('genresContainer');
        
        var row = document.createElement('div');
        row.className = 'genre-row';
        
        var title = document.createElement('div');
        title.className = 'genre-row-title';
        title.textContent = genre;
        row.appendChild(title);
        
        var itemsContainer = document.createElement('div');
        itemsContainer.className = 'items-container';
        itemsContainer.setAttribute('data-genre', genre);
        
        items.forEach(function(item) {
            var card = createItemCard(item);
            itemsContainer.appendChild(card);
        });
        
        row.appendChild(itemsContainer);
        genresContainer.appendChild(row);
    }
    
    function createItemCard(item) {
        var card = document.createElement('div');
        card.className = 'item-card';
        card.setAttribute('tabindex', '0');
        card.setAttribute('data-item-id', item.Id);
        
        var poster = document.createElement('img');
        poster.className = 'item-poster';
        poster.alt = item.Name;
        
        // Use ImageHelper for smart image selection
        if (typeof ImageHelper !== 'undefined') {
            var imageUrl = ImageHelper.getImageUrl(auth.serverAddress, item);
            poster.src = imageUrl || ImageHelper.getPlaceholderUrl(item);
            
            // Apply aspect ratio class
            var aspect = ImageHelper.getAspectRatio(item, ImageHelper.getImageType());
            if (aspect > 1.5) {
                card.classList.add('landscape-card');
            } else if (aspect > 1.1) {
                card.classList.add('wide-card');
            }
        } else {
            // Fallback to old logic
            if (item.ImageTags && item.ImageTags.Primary) {
                poster.src = auth.serverAddress + '/Items/' + item.Id + '/Images/Primary?maxHeight=450&quality=90';
            } else {
                poster.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"%3E%3Crect fill="%23333" width="200" height="300"/%3E%3C/svg%3E';
            }
        }
        
        card.appendChild(poster);
        
        var info = document.createElement('div');
        info.className = 'item-info';
        
        var name = document.createElement('div');
        name.className = 'item-name';
        name.textContent = item.Name;
        info.appendChild(name);
        
        if (item.ProductionYear) {
            var year = document.createElement('div');
            year.className = 'item-year';
            year.textContent = item.ProductionYear;
            info.appendChild(year);
        }
        
        card.appendChild(info);
        
        card.addEventListener('click', function() {
            window.location.href = 'details.html?id=' + item.Id;
        });
        
        card.addEventListener('keydown', function(e) {
            if (e.keyCode === KeyCodes.ENTER) {
                e.preventDefault();
                window.location.href = 'details.html?id=' + item.Id;
            }
        });
        
        return card;
    }
    
    function setupNavigation() {
        var genreRows = document.querySelectorAll('.genre-row');
        var currentRowIndex = 0;
        var currentItemIndex = 0;
        
        function getCurrentRow() {
            return genreRows[currentRowIndex];
        }
        
        function getCurrentItems() {
            var row = getCurrentRow();
            if (!row) return [];
            return row.querySelectorAll('.item-card');
        }
        
        function focusCurrentItem() {
            var items = getCurrentItems();
            if (items.length > 0) {
                currentItemIndex = Math.min(currentItemIndex, items.length - 1);
                items[currentItemIndex].focus();
                
                // Scroll item into view
                var container = getCurrentRow().querySelector('.items-container');
                var item = items[currentItemIndex];
                var itemLeft = item.offsetLeft;
                var itemWidth = item.offsetWidth;
                var containerWidth = container.offsetWidth;
                var scrollPos = container.scrollLeft;
                
                if (itemLeft < scrollPos) {
                    container.scrollLeft = itemLeft - 20;
                } else if (itemLeft + itemWidth > scrollPos + containerWidth) {
                    container.scrollLeft = itemLeft + itemWidth - containerWidth + 20;
                }
            }
        }
        
        function handleNavigation(e) {
            var items = getCurrentItems();
            
            if (e.keyCode === KeyCodes.LEFT) {
                e.preventDefault();
                if (currentItemIndex > 0) {
                    currentItemIndex--;
                    focusCurrentItem();
                }
            } else if (e.keyCode === KeyCodes.RIGHT) {
                e.preventDefault();
                if (currentItemIndex < items.length - 1) {
                    currentItemIndex++;
                    focusCurrentItem();
                }
            } else if (e.keyCode === KeyCodes.UP) {
                e.preventDefault();
                if (currentRowIndex > 0) {
                    currentRowIndex--;
                    focusCurrentItem();
                } else {
                    // Navigate to navbar - wait for it to be loaded
                    setTimeout(function() {
                        var homeBtn = document.getElementById('homeBtn');
                        if (homeBtn) homeBtn.focus();
                    }, 100);
                }
            } else if (e.keyCode === KeyCodes.DOWN) {
                e.preventDefault();
                if (currentRowIndex < genreRows.length - 1) {
                    currentRowIndex++;
                    focusCurrentItem();
                }
            } else if (e.keyCode === KeyCodes.BACK) {
                e.preventDefault();
                window.location.href = 'browse.html';
            }
        }
        
        // Add navigation to all items
        genreRows.forEach(function(row, rowIndex) {
            var items = row.querySelectorAll('.item-card');
            items.forEach(function(item, itemIndex) {
                item.addEventListener('keydown', function(e) {
                    currentRowIndex = rowIndex;
                    currentItemIndex = itemIndex;
                    handleNavigation(e);
                });
            });
        });
        
        // Set up navbar navigation after a delay to ensure navbar is loaded
        setTimeout(function() {
            var navButtons = document.querySelectorAll('.nav-btn');
            navButtons.forEach(function(btn) {
                btn.addEventListener('keydown', function(e) {
                    if (e.keyCode === KeyCodes.DOWN) {
                        e.preventDefault();
                        currentRowIndex = 0;
                        currentItemIndex = 0;
                        focusCurrentItem();
                    }
                });
            });
        }, 500);
        
        // Focus first item
        if (genreRows.length > 0) {
            focusCurrentItem();
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
