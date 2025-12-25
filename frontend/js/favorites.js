(function() {
    'use strict';
    
    var auth;
    var favoritesData = {
        movies: [],
        series: [],
        episodes: [],
        people: []
    };
    
    function init() {
        
        // Use MultiServerManager if available, otherwise fall back to JellyfinAPI
        auth = typeof MultiServerManager !== 'undefined' 
            ? MultiServerManager.getAuthForPage() 
            : JellyfinAPI.getStoredAuth();
        
        if (!auth) {
            window.location.href = 'login.html';
            return;
        }
        
        storage.applyBackdropBlur(document.getElementById('globalBackdropImage'), 'backdropBlurHome', 20);
        loadFavorites();
    }
    
    function loadFavorites() {
        var loadingContainer = document.getElementById('loadingContainer');
        var favoritesContainer = document.getElementById('favoritesContainer');
        var errorMessage = document.getElementById('errorMessage');
        
        var loadedCategories = 0;
        var totalCategories = 4;
        
        function checkComplete() {
            loadedCategories++;
            if (loadedCategories === totalCategories) {
                loadingContainer.style.display = 'none';
                
                var hasContent = false;
                
                // Render each category that has items
                if (favoritesData.movies.length > 0) {
                    renderFavoritesRow('Favorite Movies', favoritesData.movies);
                    hasContent = true;
                }
                
                if (favoritesData.series.length > 0) {
                    renderFavoritesRow('Favorite TV Shows', favoritesData.series);
                    hasContent = true;
                }
                
                if (favoritesData.episodes.length > 0) {
                    renderFavoritesRow('Favorite Episodes', favoritesData.episodes);
                    hasContent = true;
                }
                
                if (favoritesData.people.length > 0) {
                    renderFavoritesRow('Favorite Actors', favoritesData.people);
                    hasContent = true;
                }
                
                if (!hasContent) {
                    errorMessage.textContent = 'No favorites found';
                    errorMessage.style.display = 'block';
                } else {
                    setupNavigation();
                }
            }
        }
        
        // Load favorite movies
        var moviesParams = {
            userId: auth.userId,
            includeItemTypes: 'Movie',
            filters: 'IsFavorite',
            recursive: true,
            fields: 'PrimaryImageAspectRatio,ProductionYear',
            sortBy: 'SortName',
            sortOrder: 'Ascending',
            limit: 100
        };
        
        JellyfinAPI.getItems(auth.serverAddress, auth.accessToken, '/Users/' + auth.userId + '/Items', moviesParams, function(err, data) {
            if (!err && data && data.Items) {
                favoritesData.movies = data.Items;
            }
            checkComplete();
        });
        
        // Load favorite TV shows
        var seriesParams = {
            userId: auth.userId,
            includeItemTypes: 'Series',
            filters: 'IsFavorite',
            recursive: true,
            fields: 'PrimaryImageAspectRatio,ProductionYear',
            sortBy: 'SortName',
            sortOrder: 'Ascending',
            limit: 100
        };
        
        JellyfinAPI.getItems(auth.serverAddress, auth.accessToken, '/Users/' + auth.userId + '/Items', seriesParams, function(err, data) {
            if (!err && data && data.Items) {
                favoritesData.series = data.Items;
            }
            checkComplete();
        });
        
        // Load favorite episodes
        var episodesParams = {
            userId: auth.userId,
            includeItemTypes: 'Episode',
            filters: 'IsFavorite',
            recursive: true,
            fields: 'PrimaryImageAspectRatio,SeriesName,SeasonName',
            sortBy: 'SeriesSortName,ParentIndexNumber,IndexNumber',
            sortOrder: 'Ascending',
            limit: 100
        };
        
        JellyfinAPI.getItems(auth.serverAddress, auth.accessToken, '/Users/' + auth.userId + '/Items', episodesParams, function(err, data) {
            if (!err && data && data.Items) {
                favoritesData.episodes = data.Items;
            }
            checkComplete();
        });
        
        // Load favorite people (actors) - use Persons endpoint
        var peopleParams = {
            userId: auth.userId,
            filters: 'IsFavorite',
            fields: 'PrimaryImageAspectRatio',
            sortBy: 'SortName',
            sortOrder: 'Ascending',
            limit: 100,
            personTypes: 'Actor'
        };
        
        JellyfinAPI.getItems(auth.serverAddress, auth.accessToken, '/Persons', peopleParams, function(err, data) {
            if (!err && data && data.Items) {
                favoritesData.people = data.Items;
            }
            checkComplete();
        });
    }
    
    function renderFavoritesRow(title, items) {
        var favoritesContainer = document.getElementById('favoritesContainer');
        
        var row = document.createElement('div');
        row.className = 'favorites-row';
        
        var rowTitle = document.createElement('div');
        rowTitle.className = 'favorites-row-title';
        rowTitle.textContent = title;
        row.appendChild(rowTitle);
        
        var itemsContainer = document.createElement('div');
        itemsContainer.className = 'items-container';
        itemsContainer.setAttribute('data-category', title);
        
        items.forEach(function(item) {
            var card = createItemCard(item);
            itemsContainer.appendChild(card);
        });
        
        row.appendChild(itemsContainer);
        favoritesContainer.appendChild(row);
    }
    
    function createItemCard(item) {
        var card = document.createElement('div');
        card.className = 'item-card';
        card.setAttribute('tabindex', '0');
        card.setAttribute('data-item-id', item.Id);
        
        var poster = document.createElement('img');
        poster.className = 'item-poster';
        poster.alt = item.Name;
        
        if (item.ImageTags && item.ImageTags.Primary) {
            poster.src = auth.serverAddress + '/Items/' + item.Id + '/Images/Primary?maxHeight=450&quality=90';
        } else {
            poster.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"%3E%3Crect fill="%23333" width="200" height="300"/%3E%3C/svg%3E';
        }
        
        card.appendChild(poster);
        
        var info = document.createElement('div');
        info.className = 'item-info';
        
        var name = document.createElement('div');
        name.className = 'item-name';
        
        // For episodes, show series name and episode info
        if (item.Type === 'Episode') {
            name.textContent = item.SeriesName + ' - ' + item.Name;
        } else {
            name.textContent = item.Name;
        }
        
        info.appendChild(name);
        
        if (item.ProductionYear) {
            var year = document.createElement('div');
            year.className = 'item-year';
            year.textContent = item.ProductionYear;
            info.appendChild(year);
        }
        
        card.appendChild(info);
        
        card.addEventListener('click', function() {
            var url = 'details.html?id=' + item.Id;
            if (item.MultiServerId) {
                url += '&serverId=' + item.MultiServerId;
            }
            window.location.href = url;
        });
        
        card.addEventListener('keydown', function(e) {
            if (e.keyCode === KeyCodes.ENTER) {
                e.preventDefault();
                var url = 'details.html?id=' + item.Id;
                if (item.MultiServerId) {
                    url += '&serverId=' + item.MultiServerId;
                }
                window.location.href = url;
            }
        });
        
        return card;
    }
    
    function setupNavigation() {
        var favoritesRows = document.querySelectorAll('.favorites-row');
        var currentRowIndex = 0;
        var currentItemIndex = 0;
        
        function getCurrentRow() {
            return favoritesRows[currentRowIndex];
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
                    // Navigate to navbar
                    var homeBtn = document.getElementById('homeBtn');
                    if (homeBtn) homeBtn.focus();
                }
            } else if (e.keyCode === KeyCodes.DOWN) {
                e.preventDefault();
                if (currentRowIndex < favoritesRows.length - 1) {
                    currentRowIndex++;
                    focusCurrentItem();
                }
            } else if (e.keyCode === KeyCodes.BACK) {
                e.preventDefault();
                window.location.href = 'browse.html';
            }
        }
        
        // Add navigation to all items
        favoritesRows.forEach(function(row, rowIndex) {
            var items = row.querySelectorAll('.item-card');
            items.forEach(function(item, itemIndex) {
                item.addEventListener('keydown', function(e) {
                    currentRowIndex = rowIndex;
                    currentItemIndex = itemIndex;
                    handleNavigation(e);
                });
            });
        });
        
        // Handle navigation from navbar back to content
        // Wait a moment for navbar to fully load
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
        }, 100);
        
        // Focus first item
        if (favoritesRows.length > 0) {
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
