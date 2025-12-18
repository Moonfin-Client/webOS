/*
 * Jellyseerr Details Controller
 * Handles media details display and request functionality
 */

var JellyseerrDetailsController = (function() {
    'use strict';

    var auth = null;
    var mediaType = null;
    var mediaId = null;
    var mediaData = null;
    var fullDetails = null;
    
    var focusManager = {
        currentSection: 'buttons',
        currentIndex: 0,
        inModal: false
    };
    
    var elements = {};
    var selectedSeasons = [];

    /**
     * Initialize the controller
     */
    function init() {
        auth = JellyfinAPI.getStoredAuth();
        if (!auth) {
            window.location.href = 'login.html';
            return;
        }

        // Get media info from URL
        var params = new URLSearchParams(window.location.search);
        mediaType = params.get('type');
        mediaId = parseInt(params.get('id'));

        if (!mediaType || !mediaId) {
            window.location.href = 'discover.html';
            return;
        }

        cacheElements();
        setupEventListeners();
        
        // Initialize Jellyseerr API before loading details
        initializeJellyseerr()
            .then(function() {
                return JellyseerrAPI.attemptAutoLogin();
            })
            .then(function() {
                loadMediaDetails();
            })
            .catch(function(error) {
                showError('Failed to initialize Jellyseerr');
            });
        
        // Initialize navbar
        if (typeof NavbarController !== 'undefined') {
            NavbarController.init('discover');
        }
    }
    
    /**
     * Initialize Jellyseerr API
     */
    /**
     * Initialize Jellyseerr integration
     * @private
     */
    function initializeJellyseerr() {
        // Try initializeFromPreferences first (for existing auth)
        return JellyseerrAPI.initializeFromPreferences()
            .then(function(success) {
                if (success) {
                    console.log('[Jellyseerr Details] initializeFromPreferences succeeded');
                    return success;
                }
                
                // If initializeFromPreferences returns false, it means no auth yet
                // But we still need to initialize the API with the server URL
                console.log('[Jellyseerr Details] initializeFromPreferences returned false, trying direct initialization');
                var settings = storage.get('jellyfin_settings');
                if (!settings) return false;
                
                var parsedSettings = JSON.parse(settings);
                if (!parsedSettings.jellyseerrUrl) return false;
                
                // Get user ID for cookie storage
                var auth = JellyfinAPI.getStoredAuth();
                var userId = auth && auth.userId ? auth.userId : null;
                
                // Initialize directly with just the server URL (no auth required)
                return JellyseerrAPI.initialize(parsedSettings.jellyseerrUrl, null, userId)
                    .then(function() {
                        console.log('[Jellyseerr Details] Direct initialization succeeded');
                        return false; // Return false because we're not authenticated yet
                    });
            });
    }

    /**
     * Cache DOM elements
     */
    function cacheElements() {
        elements = {
            loadingIndicator: document.getElementById('loadingIndicator'),
            mainContent: document.getElementById('mainContent'),
            backdropImage: document.getElementById('backdropImage'),
            posterImage: document.getElementById('posterImage'),
            mediaTitle: document.getElementById('mediaTitle'),
            mediaYear: document.getElementById('mediaYear'),
            mediaRating: document.getElementById('mediaRating'),
            mediaRuntime: document.getElementById('mediaRuntime'),
            mediaGenres: document.getElementById('mediaGenres'),
            statusBadge: document.getElementById('statusBadge'),
            requestBtn: document.getElementById('requestBtn'),
            requestBtnWrapper: document.getElementById('requestBtnWrapper'),
            request4kBtn: document.getElementById('request4kBtn'),
            request4kBtnWrapper: document.getElementById('request4kBtnWrapper'),
            trailerBtn: document.getElementById('trailerBtn'),
            trailerBtnWrapper: document.getElementById('trailerBtnWrapper'),
            playBtn: document.getElementById('playBtn'),
            playBtnWrapper: document.getElementById('playBtnWrapper'),
            tagline: document.getElementById('tagline'),
            overview: document.getElementById('overview'),
            castSection: document.getElementById('castSection'),
            castList: document.getElementById('castList'),
            similarSection: document.getElementById('similarSection'),
            similarList: document.getElementById('similarList'),
            seasonModal: document.getElementById('seasonModal'),
            seasonList: document.getElementById('seasonList'),
            allSeasonsBtn: document.getElementById('allSeasonsBtn'),
            confirmRequestBtn: document.getElementById('confirmRequestBtn'),
            cancelRequestBtn: document.getElementById('cancelRequestBtn'),
            errorModal: document.getElementById('errorModal'),
            errorMessage: document.getElementById('errorMessage'),
            errorOkBtn: document.getElementById('errorOkBtn')
        };
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        document.addEventListener('keydown', handleKeyDown);
        
        if (elements.requestBtn) {
            elements.requestBtn.addEventListener('click', function() {
                handleRequest(false);
            });
        }
        
        if (elements.request4kBtn) {
            elements.request4kBtn.addEventListener('click', function() {
                handleRequest(true);
            });
        }
        
        if (elements.trailerBtn) {
            elements.trailerBtn.addEventListener('click', handleTrailer);
        }
        
        if (elements.playBtn) {
            elements.playBtn.addEventListener('click', handlePlay);
        }
        
        // Modal buttons
        if (elements.allSeasonsBtn) {
            elements.allSeasonsBtn.addEventListener('click', selectAllSeasons);
        }
        if (elements.confirmRequestBtn) {
            elements.confirmRequestBtn.addEventListener('click', confirmRequest);
        }
        if (elements.cancelRequestBtn) {
            elements.cancelRequestBtn.addEventListener('click', closeModal);
        }
        
        // Error modal OK button
        if (elements.errorOkBtn) {
            elements.errorOkBtn.addEventListener('click', closeErrorModal);
        }
    }

    /**
     * Load media details from Jellyseerr API
     */
    function loadMediaDetails() {
        console.log('[Jellyseerr Details] Loading details for', mediaType, mediaId);
        
        var detailsPromise = mediaType === 'movie' 
            ? JellyseerrAPI.getMovieDetails(mediaId)
            : JellyseerrAPI.getTvDetails(mediaId);
        
        detailsPromise
            .then(function(details) {
                console.log('[Jellyseerr Details] Received details:', details);
                fullDetails = details;
                mediaData = details;
                renderMediaDetails();
                loadCast();
                loadSimilar();
            })
            .catch(function(error) {
                console.error('[Jellyseerr Details] Failed to load details:', error);
                showError('Failed to load media details');
            });
    }

    /**
     * Render media details to the page
     */
    function renderMediaDetails() {
        console.log('[Jellyseerr Details] Rendering media details:', mediaData);
        
        // Hide loading, show content
        elements.loadingIndicator.style.display = 'none';
        elements.mainContent.style.display = 'block';
        
        // Backdrop
        if (mediaData.backdropPath) {
            elements.backdropImage.src = ImageHelper.getTMDBImageUrl(mediaData.backdropPath, 'original');
        }
        
        // Poster
        if (mediaData.posterPath) {
            elements.posterImage.src = ImageHelper.getTMDBImageUrl(mediaData.posterPath, 'w500');
        }
        
        // Title
        elements.mediaTitle.textContent = mediaData.title || mediaData.name || 'Unknown';
        
        // Year
        var year = null;
        if (mediaData.releaseDate) {
            year = new Date(mediaData.releaseDate).getFullYear();
        } else if (mediaData.firstAirDate) {
            year = new Date(mediaData.firstAirDate).getFullYear();
        }
        if (year) {
            elements.mediaYear.textContent = year;
            elements.mediaYear.style.display = 'inline';
        }
        
        // Rating
        if (mediaData.voteAverage) {
            elements.mediaRating.textContent = '⭐ ' + mediaData.voteAverage.toFixed(1);
            elements.mediaRating.style.display = 'inline';
        }
        
        // Runtime
        if (mediaData.runtime) {
            var hours = Math.floor(mediaData.runtime / 60);
            var minutes = mediaData.runtime % 60;
            elements.mediaRuntime.textContent = hours + 'h ' + minutes + 'm';
            elements.mediaRuntime.style.display = 'inline';
        }
        
        // Genres
        if (mediaData.genres && mediaData.genres.length > 0) {
            var genreNames = mediaData.genres.map(function(g) { return g.name; }).join(', ');
            elements.mediaGenres.textContent = genreNames;
            elements.mediaGenres.style.display = 'inline';
        }
        
        // Status badge
        updateStatusBadge();
        
        // Request buttons
        updateRequestButtons();
        
        // Tagline
        if (mediaData.tagline) {
            elements.tagline.textContent = mediaData.tagline;
            elements.tagline.style.display = 'block';
        }
        
        // Overview
        if (mediaData.overview) {
            elements.overview.textContent = mediaData.overview;
        }
        
        // Focus first button
        setTimeout(function() {
            var buttons = getActionButtons();
            if (buttons.length > 0) {
                buttons[0].focus();
            }
        }, 100);
    }

    /**
     * Update status badge based on media info
     */
    function updateStatusBadge() {
        if (!mediaData.mediaInfo || !mediaData.mediaInfo.status) {
            return;
        }
        
        var status = mediaData.mediaInfo.status;
        var statusText = '';
        var statusClass = '';
        
        switch (status) {
            case 2:
                statusText = 'Pending';
                statusClass = 'pending';
                break;
            case 3:
                statusText = 'Processing';
                statusClass = 'processing';
                break;
            case 4:
                statusText = 'Partially Available';
                statusClass = 'available';
                break;
            case 5:
                statusText = 'Available';
                statusClass = 'available';
                break;
        }
        
        if (statusText) {
            elements.statusBadge.textContent = statusText;
            elements.statusBadge.className = 'status-badge ' + statusClass;
            elements.statusBadge.style.display = 'inline-block';
        }
    }

    /**
     * Update request buttons state
     */
    function updateRequestButtons() {
        var mediaInfo = mediaData.mediaInfo;
        var hdStatus = mediaInfo ? mediaInfo.status : null;
        var status4k = mediaInfo ? mediaInfo.status4k : null;
        
        // HD button
        var hdDisabled = (hdStatus !== null && hdStatus >= 2 && hdStatus !== 4);
        elements.requestBtn.disabled = hdDisabled;
        var requestLabel = elements.requestBtnWrapper.querySelector('.btn-label');
        if (hdStatus === 2) {
            requestLabel.textContent = 'HD Pending';
        } else if (hdStatus === 3) {
            requestLabel.textContent = 'HD Processing';
        } else if (hdStatus === 5) {
            requestLabel.textContent = 'HD Available';
        } else if (hdStatus === 4) {
            requestLabel.textContent = 'Request More (HD)';
        }
        
        // 4K button
        var fourKDisabled = (status4k !== null && status4k >= 2 && status4k !== 4);
        elements.request4kBtn.disabled = fourKDisabled;
        var request4kLabel = elements.request4kBtnWrapper.querySelector('.btn-label');
        if (status4k === 2) {
            request4kLabel.textContent = '4K Pending';
        } else if (status4k === 3) {
            request4kLabel.textContent = '4K Processing';
        } else if (status4k === 5) {
            request4kLabel.textContent = '4K Available';
        } else if (status4k === 4) {
            request4kLabel.textContent = 'Request More (4K)';
        }
        
        // Show Play button if available
        if (hdStatus === 5 || hdStatus === 4) {
            elements.playBtnWrapper.style.display = 'flex';
        }
    }

    /**
     * Load cast members
     */
    function loadCast() {
        if (!mediaData.credits || !mediaData.credits.cast) {
            return;
        }
        
        var cast = mediaData.credits.cast.slice(0, 10); // Show first 10
        if (cast.length === 0) {
            return;
        }
        
        elements.castSection.style.display = 'block';
        elements.castList.innerHTML = '';
        
        cast.forEach(function(person) {
            var card = createCastCard(person);
            elements.castList.appendChild(card);
        });
    }

    /**
     * Create a cast card element
     */
    function createCastCard(person) {
        var card = document.createElement('div');
        card.className = 'cast-card';
        card.tabIndex = 0;
        card.dataset.personId = person.id;
        card.dataset.personName = person.name;
        
        var photoContainer = document.createElement('div');
        photoContainer.className = 'cast-photo-container';
        
        if (person.profilePath) {
            var photo = document.createElement('img');
            photo.className = 'cast-photo';
            photo.src = ImageHelper.getTMDBImageUrl(person.profilePath, 'w185');
            photo.alt = person.name;
            photoContainer.appendChild(photo);
        }
        
        card.appendChild(photoContainer);
        
        var name = document.createElement('p');
        name.className = 'cast-name';
        name.textContent = person.name;
        card.appendChild(name);
        
        if (person.character) {
            var character = document.createElement('p');
            character.className = 'cast-character';
            character.textContent = person.character;
            card.appendChild(character);
        }
        
        // Click handler - navigate to person details
        card.addEventListener('click', function(evt) {
            evt.preventDefault();
            evt.stopPropagation();
            navigateToPerson(person.id, person.name);
        });
        
        card.addEventListener('keydown', function(evt) {
            if (evt.keyCode === KeyCodes.ENTER || evt.keyCode === KeyCodes.OK) {
                evt.preventDefault();
                evt.stopPropagation();
                navigateToPerson(person.id, person.name);
            } else {
                handleCastKeyDown(evt);
            }
        });
        
        return card;
    }

    /**
     * Load similar content
     */
    function loadSimilar() {
        var similarPromise = mediaType === 'movie'
            ? JellyseerrAPI.getSimilarMovies(mediaId)
            : JellyseerrAPI.getSimilarTv(mediaId);
        
        similarPromise
            .then(function(response) {
                var results = response.results || [];
                if (results.length === 0) {
                    return;
                }
                
                elements.similarSection.style.display = 'block';
                elements.similarList.innerHTML = '';
                
                results.slice(0, 10).forEach(function(item) {
                    var card = createSimilarCard(item);
                    elements.similarList.appendChild(card);
                });
            })
            .catch(function(error) {
            });
    }

    /**
     * Create a similar content card
     */
    function createSimilarCard(item) {
        var card = document.createElement('div');
        card.className = 'similar-card';
        card.tabIndex = 0;
        
        if (item.posterPath) {
            var poster = document.createElement('img');
            poster.className = 'similar-poster';
            poster.src = ImageHelper.getTMDBImageUrl(item.posterPath, 'w500');
            poster.alt = item.title || item.name;
            card.appendChild(poster);
        }
        
        var title = document.createElement('div');
        title.className = 'similar-title';
        title.textContent = item.title || item.name || 'Unknown';
        card.appendChild(title);
        
        card.addEventListener('click', function() {
            window.location.href = 'jellyseerr-details.html?type=' + item.mediaType + '&id=' + item.id;
        });
        
        card.addEventListener('keydown', function(e) {
            if (e.keyCode === KeyCodes.ENTER) {
                e.preventDefault();
                window.location.href = 'jellyseerr-details.html?type=' + item.mediaType + '&id=' + item.id;
            }
            handleSimilarKeyDown(e);
        });
        
        return card;
    }

    /**
     * Handle request button click
     */
    function handleRequest(is4k) {
        if (mediaType === 'tv') {
            // Show season selection modal
            showSeasonModal(is4k);
        } else {
            // Movie - request directly
            submitRequest(null, is4k);
        }
    }

    /**
     * Show season selection modal for TV shows
     */
    function showSeasonModal(is4k) {
        if (!fullDetails || !fullDetails.seasons) {
            submitRequest(null, is4k);
            return;
        }
        
        selectedSeasons = [];
        focusManager.inModal = true;
        focusManager.is4k = is4k;
        
        // Build season list
        elements.seasonList.innerHTML = '';
        fullDetails.seasons.forEach(function(season) {
            if (season.seasonNumber === 0) return; // Skip specials
            
            var checkbox = document.createElement('div');
            checkbox.className = 'season-checkbox';
            checkbox.tabIndex = 0;
            
            var input = document.createElement('input');
            input.type = 'checkbox';
            input.id = 'season-' + season.seasonNumber;
            input.value = season.seasonNumber;
            
            var label = document.createElement('label');
            label.htmlFor = 'season-' + season.seasonNumber;
            label.textContent = 'Season ' + season.seasonNumber;
            
            checkbox.appendChild(input);
            checkbox.appendChild(label);
            
            // Toggle on click
            checkbox.addEventListener('click', function() {
                input.checked = !input.checked;
            });
            
            // Toggle on ENTER or OK key
            checkbox.addEventListener('keydown', function(evt) {
                if (evt.keyCode === KeyCodes.ENTER || evt.keyCode === KeyCodes.OK) {
                    evt.preventDefault();
                    input.checked = !input.checked;
                }
            });
            
            elements.seasonList.appendChild(checkbox);
        });
        
        elements.seasonModal.style.display = 'flex';
        
        setTimeout(function() {
            elements.allSeasonsBtn.focus();
        }, 100);
    }

    /**
     * Select all seasons
     */
    function selectAllSeasons() {
        var checkboxes = elements.seasonList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(function(checkbox) {
            checkbox.checked = true;
        });
    }

    /**
     * Select first season only
     */
    function selectFirstSeason() {
        var checkboxes = elements.seasonList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(function(checkbox, index) {
            checkbox.checked = (index === 0);
        });
    }

    /**
     * Select latest season only
     */
    function selectLatestSeason() {
        var checkboxes = elements.seasonList.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(function(checkbox, index) {
            checkbox.checked = (index === checkboxes.length - 1);
        });
    }

    /**
     * Confirm request from modal
     */
    function confirmRequest() {
        var checkboxes = elements.seasonList.querySelectorAll('input[type="checkbox"]:checked');
        var seasons = Array.from(checkboxes).map(function(cb) {
            return parseInt(cb.value);
        });
        
        if (seasons.length === 0) {
            alert('Please select at least one season');
            return;
        }
        
        closeModal();
        submitRequest(seasons, focusManager.is4k);
    }

    /**
     * Submit request to Jellyseerr
     */
    function submitRequest(seasons, is4k) {
        
        var requestData = {
            mediaId: mediaId,
            mediaType: mediaType,
            is4k: is4k || false
        };
        
        // Add seasons for TV shows
        if (mediaType === 'tv') {
            if (seasons && seasons.length > 0) {
                requestData.seasons = seasons;
            } else {
                requestData.seasons = 'all';
            }
        }
        
        JellyseerrAPI.createRequest(requestData)
            .then(function(response) {
                showSuccessMessage((is4k ? '4K' : 'HD') + ' request submitted successfully!');
                // Reload details to update status
                loadMediaDetails();
            })
            .catch(function(error) {
                handleRequestError(error);
            });
    }

    /**
     * Navigate to person details page
     */
    function navigateToPerson(personId, personName) {
        console.log('[Jellyseerr Details] Navigating to person:', personId, personName);
        window.location.href = 'jellyseerr-person.html?id=' + personId + 
                             '&name=' + encodeURIComponent(personName);
    }

    /**
     * Handle request errors with proper messaging
     */
    function handleRequestError(error) {
        
        var message = 'Failed to submit request.';
        
        if (error.status === 403) {
            message = 'You do not have permission to request content. Please contact your administrator to grant you request permissions in Jellyseerr.';
        } else if (error.status === 401) {
            message = 'Authentication failed. Please check your Jellyseerr connection in settings.';
        } else if (error.status === 409) {
            message = 'This content has already been requested or is currently available.';
        } else if (error.status === 404) {
            message = 'Content not found in Jellyseerr. Please try again later.';
        } else if (error.message) {
            message = 'Request failed: ' + error.message;
        }
        
        showErrorDialog(message);
    }

    /**
     * Show error dialog
     */
    function showErrorDialog(message) {
        elements.errorMessage.textContent = message;
        elements.errorModal.style.display = 'flex';
        
        setTimeout(function() {
            elements.errorOkBtn.focus();
        }, 100);
    }

    /**
     * Show success message (using alert for now, could be replaced with toast)
     */
    function showSuccessMessage(message) {
        alert(message);
    }

    /**
     * Close error modal
     */
    function closeErrorModal() {
        elements.errorModal.style.display = 'none';
        
        // Return focus to last focused element
        setTimeout(function() {
            var buttons = getActionButtons();
            if (buttons.length > 0) {
                buttons[focusManager.currentIndex].focus();
            }
        }, 100);
    }

    /**
     * Close modal
     */
    function closeModal() {
        elements.seasonModal.style.display = 'none';
        focusManager.inModal = false;
        
        setTimeout(function() {
            var buttons = getActionButtons();
            if (buttons.length > 0) {
                buttons[focusManager.currentIndex].focus();
            }
        }, 100);
    }

    /**
     * Handle trailer button
     */
    function handleTrailer() {
        // Open YouTube search for trailer
        var title = mediaData.title || mediaData.name || 'Unknown';
        var year = '';
        if (mediaData.releaseDate) {
            year = new Date(mediaData.releaseDate).getFullYear();
        } else if (mediaData.firstAirDate) {
            year = new Date(mediaData.firstAirDate).getFullYear();
        }
        
        var searchQuery = encodeURIComponent(title + ' ' + year + ' official trailer');
        var youtubeUrl = 'https://www.youtube.com/results?search_query=' + searchQuery;
        
        if (typeof webOS !== 'undefined') {
            webOS.service.request('luna://com.webos.applicationManager', {
                method: 'launch',
                parameters: {
                    id: 'youtube.leanback.v4',
                    params: {
                        contentTarget: youtubeUrl
                    }
                }
            });
        } else {
            window.open(youtubeUrl, '_blank');
        }
    }

    /**
     * Handle play button - search Jellyfin library and redirect to details
     */
    function handlePlay() {
        var searchTitle = mediaData.title || mediaData.name;
        var year = mediaData.releaseDate ? new Date(mediaData.releaseDate).getFullYear() : 
                   (mediaData.firstAirDate ? new Date(mediaData.firstAirDate).getFullYear() : null);
        
        // Search for this content in Jellyfin library
        var auth = JellyfinAPI.getStoredAuth();
        if (!auth) {
            window.location.href = 'search.html?query=' + encodeURIComponent(searchTitle);
            return;
        }
        
        // Build search query
        var params = [
            'SearchTerm=' + encodeURIComponent(searchTitle),
            'IncludeItemTypes=' + (mediaType === 'movie' ? 'Movie' : 'Series'),
            'Recursive=true',
            'Limit=10',
            'Fields=Overview,ProductionYear'
        ];
        
        var url = auth.serverAddress + '/Users/' + auth.userId + '/Items?' + params.join('&');
        
        ajax.request(url, {
            method: 'GET',
            headers: {
                'X-Emby-Token': auth.accessToken
            },
            success: function(response) {
                var items = response.Items || [];
                
                if (items.length === 0) {
                    // No results, go to search page
                    window.location.href = 'search.html?query=' + encodeURIComponent(searchTitle);
                    return;
                }
                
                // Try to find exact match by name and year
                var exactMatch = null;
                if (year) {
                    exactMatch = items.find(function(item) {
                        return item.ProductionYear === year;
                    });
                }
                
                // Use first result if no exact match
                var targetItem = exactMatch || items[0];
                
                // Redirect to details page
                window.location.href = 'details.html?id=' + targetItem.Id;
            },
            error: function(error) {
                // Fallback to search page
                window.location.href = 'search.html?query=' + encodeURIComponent(searchTitle);
            }
        });
    }

    /**
     * Navigate to similar content
     */
    function navigateToSimilar(id, type) {
        window.location.href = 'jellyseerr-details.html?type=' + type + '&id=' + id;
    }

    /**
     * Get action buttons
     */
    function getActionButtons() {
        return Array.from(document.querySelectorAll('.btn-action')).filter(function(btn) {
            var wrapper = btn.closest('.btn-wrapper');
            return wrapper && wrapper.style.display !== 'none' && !btn.disabled;
        });
    }
    
    /**
     * Get cast cards
     */
    function getCastCards() {
        return Array.from(document.querySelectorAll('.cast-card'));
    }
    
    /**
     * Get similar cards
     */
    function getSimilarCards() {
        return Array.from(document.querySelectorAll('.similar-card'));
    }

    /**
     * Handle keyboard navigation
     */
    function handleKeyDown(evt) {
        if (evt.keyCode === KeyCodes.BACK) {
            evt.preventDefault();
            if (focusManager.inModal) {
                closeModal();
            } else {
                window.history.back();
            }
            return;
        }
        
        if (focusManager.inModal) {
            handleModalKeyDown(evt);
            return;
        }
        
        if (focusManager.currentSection === 'buttons') {
            handleButtonKeyDown(evt);
        }
    }
    
    /**
     * Handle button section keyboard navigation
     */
    function handleButtonKeyDown(evt) {
        var buttons = getActionButtons();
        if (buttons.length === 0) return;
        
        switch (evt.keyCode) {
            case KeyCodes.LEFT:
                evt.preventDefault();
                if (focusManager.currentIndex > 0) {
                    focusManager.currentIndex--;
                    buttons[focusManager.currentIndex].focus();
                }
                break;
                
            case KeyCodes.RIGHT:
                evt.preventDefault();
                if (focusManager.currentIndex < buttons.length - 1) {
                    focusManager.currentIndex++;
                    buttons[focusManager.currentIndex].focus();
                }
                break;
                
            case KeyCodes.DOWN:
                evt.preventDefault();
                var castCards = getCastCards();
                if (castCards.length > 0) {
                    focusManager.currentSection = 'cast';
                    focusManager.currentIndex = 0;
                    castCards[0].focus();
                } else {
                    var similarCards = getSimilarCards();
                    if (similarCards.length > 0) {
                        focusManager.currentSection = 'similar';
                        focusManager.currentIndex = 0;
                        similarCards[0].focus();
                    }
                }
                break;
        }
    }
    
    /**
     * Handle cast section keyboard navigation
     */
    function handleCastKeyDown(evt) {
        var castCards = getCastCards();
        var currentIndex = castCards.indexOf(document.activeElement);
        
        switch (evt.keyCode) {
            case KeyCodes.ENTER:
            case KeyCodes.OK:
                evt.preventDefault();
                var card = document.activeElement;
                var personId = parseInt(card.dataset.personId);
                var personName = card.dataset.personName;
                if (personId) {
                    navigateToPerson(personId, personName);
                }
                break;
                
            case KeyCodes.LEFT:
                evt.preventDefault();
                if (currentIndex > 0) {
                    castCards[currentIndex - 1].focus();
                }
                break;
                
            case KeyCodes.RIGHT:
                evt.preventDefault();
                if (currentIndex < castCards.length - 1) {
                    castCards[currentIndex + 1].focus();
                }
                break;
                
            case KeyCodes.UP:
                evt.preventDefault();
                focusManager.currentSection = 'buttons';
                focusManager.currentIndex = 0;
                var buttons = getActionButtons();
                if (buttons.length > 0) {
                    buttons[0].focus();
                }
                break;
                
            case KeyCodes.DOWN:
                evt.preventDefault();
                var similarCards = getSimilarCards();
                if (similarCards.length > 0) {
                    focusManager.currentSection = 'similar';
                    focusManager.currentIndex = 0;
                    similarCards[0].focus();
                }
                break;
        }
    }
    
    /**
     * Handle similar section keyboard navigation
     */
    function handleSimilarKeyDown(evt) {
        var similarCards = getSimilarCards();
        var currentIndex = similarCards.indexOf(document.activeElement);
        
        switch (evt.keyCode) {
            case KeyCodes.LEFT:
                evt.preventDefault();
                if (currentIndex > 0) {
                    similarCards[currentIndex - 1].focus();
                }
                break;
                
            case KeyCodes.RIGHT:
                evt.preventDefault();
                if (currentIndex < similarCards.length - 1) {
                    similarCards[currentIndex + 1].focus();
                }
                break;
                
            case KeyCodes.UP:
                evt.preventDefault();
                var castCards = getCastCards();
                if (castCards.length > 0) {
                    focusManager.currentSection = 'cast';
                    focusManager.currentIndex = 0;
                    castCards[0].focus();
                } else {
                    focusManager.currentSection = 'buttons';
                    focusManager.currentIndex = 0;
                    var buttons = getActionButtons();
                    if (buttons.length > 0) {
                        buttons[0].focus();
                    }
                }
                break;
        }
    }

    /**
     * Handle modal keyboard navigation
     */
    function handleModalKeyDown(evt) {
        // Get all focusable elements in modal
        var modalButtons = [elements.allSeasonsBtn];
        var checkboxes = Array.from(elements.seasonList.querySelectorAll('.season-checkbox'));
        var actionButtons = [elements.confirmRequestBtn, elements.cancelRequestBtn];
        
        var allFocusable = modalButtons.concat(checkboxes).concat(actionButtons).filter(function(el) { return el; });
        
        var currentIndex = allFocusable.indexOf(document.activeElement);
        if (currentIndex === -1) currentIndex = 0;
        
        switch (evt.keyCode) {
            case KeyCodes.LEFT:
            case KeyCodes.UP:
                evt.preventDefault();
                if (currentIndex > 0) {
                    allFocusable[currentIndex - 1].focus();
                }
                break;
                
            case KeyCodes.RIGHT:
            case KeyCodes.DOWN:
                evt.preventDefault();
                if (currentIndex < allFocusable.length - 1) {
                    allFocusable[currentIndex + 1].focus();
                }
                break;
        }
    }

    /**
     * Show error message
     */
    function showError(message) {
        elements.loadingIndicator.querySelector('p').textContent = message;
    }

    // Public API
    return {
        init: init
    };
})();

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', JellyseerrDetailsController.init);
} else {
    JellyseerrDetailsController.init();
}
