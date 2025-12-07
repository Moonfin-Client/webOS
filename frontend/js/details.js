var DetailsController = (function() {
    'use strict';

    var auth = null;
    var itemId = null;
    var itemData = null;
    var focusManager = {
        currentSection: 'buttons',
        currentIndex: 0
    };

    var elements = {};

    function init() {
        JellyfinAPI.Logger.info('Initializing details controller...');
        
        auth = JellyfinAPI.getStoredAuth();
        if (!auth) {
            JellyfinAPI.Logger.error('No authentication found, redirecting to login');
            window.location.href = 'login.html';
            return;
        }

        itemId = getItemIdFromUrl();
        if (!itemId) {
            showError('No item specified');
            return;
        }

        JellyfinAPI.Logger.info('Loading details for item:', itemId);
        
        cacheElements();
        setupNavigation();
        loadItemDetails();
    }

    function getItemIdFromUrl() {
        var params = new URLSearchParams(window.location.search);
        return params.get('id');
    }

    function cacheElements() {
        elements = {
            backdropImage: document.getElementById('backdropImage'),
            posterImage: document.getElementById('posterImage'),
            itemTitle: document.getElementById('itemTitle'),
            itemYear: document.getElementById('itemYear'),
            officialRating: document.getElementById('officialRating'),
            itemRuntime: document.getElementById('itemRuntime'),
            runtimeValue: document.getElementById('runtimeValue'),
            itemGenres: document.getElementById('itemGenres'),
            itemResolution: document.getElementById('itemResolution'),
            videoCodec: document.getElementById('videoCodec'),
            audioCodec: document.getElementById('audioCodec'),
            subtitles: document.getElementById('subtitles'),
            communityRating: document.getElementById('communityRating'),
            ratingValue: document.getElementById('ratingValue'),
            criticRating: document.getElementById('criticRating'),
            criticIcon: document.getElementById('criticIcon'),
            criticValue: document.getElementById('criticValue'),
            itemOverview: document.getElementById('itemOverview'),
            playBtn: document.getElementById('playBtn'),
            resumeBtn: document.getElementById('resumeBtn'),
            trailerBtn: document.getElementById('trailerBtn'),
            favoriteBtn: document.getElementById('favoriteBtn'),
            favoriteIcon: document.getElementById('favoriteIcon'),
            markPlayedBtn: document.getElementById('markPlayedBtn'),
            playedText: document.getElementById('playedText'),
            castSection: document.getElementById('castSection'),
            castList: document.getElementById('castList'),
            seasonsSection: document.getElementById('seasonsSection'),
            seasonsList: document.getElementById('seasonsList'),
            episodesSection: document.getElementById('episodesSection'),
            episodesList: document.getElementById('episodesList'),
            similarSection: document.getElementById('similarSection'),
            similarList: document.getElementById('similarList'),
            extrasSection: document.getElementById('extrasSection'),
            extrasList: document.getElementById('extrasList'),
            technicalSection: document.getElementById('technicalSection'),
            technicalDetails: document.getElementById('technicalDetails'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            errorDisplay: document.getElementById('errorDisplay'),
            errorText: document.getElementById('errorText'),
            backBtn: document.getElementById('backBtn')
        };
    }

    function setupNavigation() {
        if (elements.playBtn) {
            elements.playBtn.addEventListener('click', handlePlay);
        }
        if (elements.resumeBtn) {
            elements.resumeBtn.addEventListener('click', handleResume);
        }
        if (elements.trailerBtn) {
            elements.trailerBtn.addEventListener('click', handleTrailer);
        }
        if (elements.favoriteBtn) {
            elements.favoriteBtn.addEventListener('click', handleFavorite);
        }
        if (elements.markPlayedBtn) {
            elements.markPlayedBtn.addEventListener('click', handleMarkPlayed);
        }
        if (elements.backBtn) {
            elements.backBtn.addEventListener('click', goBack);
        }

        document.addEventListener('keydown', handleKeyDown);
    }

    function handleKeyDown(evt) {
        evt = evt || window.event;
        
        if (evt.keyCode === KeyCodes.BACK || evt.keyCode === KeyCodes.ESCAPE) {
            goBack();
            return;
        }

        var buttons = Array.from(document.querySelectorAll('.action-buttons .btn-action')).filter(function(btn) {
            return btn.style.display !== 'none';
        });

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
                
            case KeyCodes.ENTER:
                evt.preventDefault();
                if (buttons[focusManager.currentIndex]) {
                    buttons[focusManager.currentIndex].click();
                }
                break;
        }
    }

    function loadItemDetails() {
        showLoading();
        
        var params = {
            userId: auth.userId,
            fields: 'Overview,Genres,People,Studios,Taglines,CommunityRating,CriticRating,OfficialRating,ProductionYear,RunTimeTicks,MediaStreams,Path,ProviderIds'
        };
        
        var endpoint = '/Users/' + auth.userId + '/Items/' + itemId;
        
        JellyfinAPI.getItems(auth.serverAddress, auth.accessToken, endpoint, params, function(err, data) {
            hideLoading();
            
            if (err || !data) {
                showError('Failed to load item details');
                return;
            }
            
            itemData = data;
            JellyfinAPI.Logger.success('Item details loaded:', itemData.Name);
            displayItemDetails();
            loadAdditionalContent();
        });
    }

    function displayItemDetails() {
        elements.itemTitle.textContent = itemData.Name;
        if (itemData.CommunityRating) {
            elements.communityRating.style.display = 'inline-flex';
            elements.ratingValue.textContent = itemData.CommunityRating.toFixed(1);
        }
        
        if (itemData.CriticRating) {
            elements.criticRating.style.display = 'inline-flex';
            var rating = itemData.CriticRating;
            if (rating >= 60) {
                elements.criticIcon.textContent = '🍅';
            } else {
                elements.criticIcon.textContent = '🍅';
            }
            elements.criticValue.textContent = rating + '%';
        }
        
        if (itemData.ProductionYear) {
            elements.itemYear.textContent = itemData.ProductionYear;
            elements.itemYear.style.display = 'inline-flex';
        }
        
        if (itemData.OfficialRating) {
            elements.officialRating.textContent = itemData.OfficialRating;
            elements.officialRating.style.display = 'inline-flex';
        }
        
        if (itemData.RunTimeTicks) {
            var minutes = Math.round(itemData.RunTimeTicks / 600000000);
            var hours = Math.floor(minutes / 60);
            var mins = minutes % 60;
            var runtimeText = hours > 0 ? hours + 'h ' + mins + 'm' : mins + 'm';
            elements.runtimeValue.textContent = runtimeText;
            elements.itemRuntime.style.display = 'inline-flex';
        }
        
        if (itemData.MediaSources && itemData.MediaSources.length > 0) {
            var mediaSource = itemData.MediaSources[0];
            
            if (mediaSource.MediaStreams) {
                var videoStream = mediaSource.MediaStreams.find(function(s) { return s.Type === 'Video'; });
                if (videoStream && videoStream.Width && videoStream.Height) {
                    var resolution = getResolutionName(videoStream.Width, videoStream.Height);
                    elements.itemResolution.textContent = resolution;
                    elements.itemResolution.style.display = 'inline-flex';
                }
                
                if (videoStream && videoStream.Codec) {
                    var codec = videoStream.Codec.toUpperCase();
                    if (videoStream.VideoRangeType && videoStream.VideoRangeType !== 'SDR') {
                        codec = videoStream.VideoRangeType.toUpperCase();
                    }
                    elements.videoCodec.textContent = codec;
                    elements.videoCodec.style.display = 'inline-flex';
                }
                
                var audioStream = mediaSource.MediaStreams.find(function(s) { return s.Type === 'Audio'; });
                if (audioStream && audioStream.Codec) {
                    var audioCodec = audioStream.Codec.toUpperCase();
                    if (audioStream.Profile && audioStream.Profile.indexOf('Atmos') > -1) {
                        audioCodec = 'ATMOS';
                    }
                    elements.audioCodec.textContent = audioCodec;
                    elements.audioCodec.style.display = 'inline-flex';
                }
                
                var hasSubtitles = mediaSource.MediaStreams.some(function(s) { return s.Type === 'Subtitle'; });
                if (hasSubtitles) {
                    elements.subtitles.style.display = 'inline-flex';
                }
            }
        }
        
        if (itemData.Genres && itemData.Genres.length > 0) {
            elements.itemGenres.textContent = itemData.Genres.slice(0, 3).join(', ');
        }
        
        if (itemData.Overview) {
            elements.itemOverview.textContent = itemData.Overview;
        }
        
        if (itemData.BackdropImageTags && itemData.BackdropImageTags.length > 0) {
            elements.backdropImage.src = auth.serverAddress + '/Items/' + itemData.Id + '/Images/Backdrop/0?quality=90&maxWidth=1920';
        } else if (itemData.ParentBackdropImageTags && itemData.ParentBackdropImageTags.length > 0) {
            elements.backdropImage.src = auth.serverAddress + '/Items/' + itemData.ParentBackdropItemId + '/Images/Backdrop/0?quality=90&maxWidth=1920';
        }
        
        if (itemData.ImageTags && itemData.ImageTags.Primary) {
            elements.posterImage.src = auth.serverAddress + '/Items/' + itemData.Id + '/Images/Primary?quality=90&maxHeight=600';
        } else if (itemData.SeriesId && itemData.SeriesPrimaryImageTag) {
            elements.posterImage.src = auth.serverAddress + '/Items/' + itemData.SeriesId + '/Images/Primary?quality=90&maxHeight=600&tag=' + itemData.SeriesPrimaryImageTag;
        }
        
        if (itemData.UserData) {
            if (itemData.UserData.IsFavorite) {
                elements.favoriteIcon.textContent = '♥';
            }
            
            if (itemData.UserData.Played) {
                elements.playedText.textContent = 'Mark Unplayed';
            }
            
            if (itemData.UserData.PlaybackPositionTicks > 0) {
                elements.resumeBtn.style.display = 'inline-flex';
            }
        }
        
        if (itemData.LocalTrailerCount > 0 || (itemData.RemoteTrailers && itemData.RemoteTrailers.length > 0)) {
            elements.trailerBtn.style.display = 'inline-flex';
        }
        
        setTimeout(function() {
            var firstBtn = document.querySelector('.action-buttons .btn-action');
            if (firstBtn) {
                firstBtn.focus();
            }
        }, 100);
    }
    
    function getResolutionName(width, height) {
        if (height >= 2160) return '4K';
        if (height >= 1440) return '1440P';
        if (height >= 1080) return '1080P';
        if (height >= 720) return '720P';
        if (height >= 576) return '576P';
        if (height >= 480) return '480P';
        return height + 'P';
    }

    function loadAdditionalContent() {
        if (itemData.People && itemData.People.length > 0) {
            displayCast(itemData.People);
        }
        
        if (itemData.Type === 'Series') {
            loadSeasons();
        }
        
        loadSimilarItems();
        displayTechnicalDetails();
    }

    function displayCast(people) {
        elements.castSection.style.display = 'block';
        elements.castList.innerHTML = '';
        
        people.slice(0, 20).forEach(function(person) {
            var castCard = document.createElement('div');
            castCard.className = 'cast-card';
            
            var img = document.createElement('img');
            img.className = 'cast-image';
            if (person.PrimaryImageTag) {
                img.src = auth.serverAddress + '/Items/' + person.Id + '/Images/Primary?quality=90&maxHeight=300&tag=' + person.PrimaryImageTag;
            } else {
                img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect fill="%23444" width="150" height="150"/%3E%3Ctext x="50%25" y="50%25" fill="%23888" font-size="40" text-anchor="middle" dy=".3em"%3E' + person.Name.charAt(0) + '%3C/text%3E%3C/svg%3E';
            }
            
            var name = document.createElement('div');
            name.className = 'cast-name';
            name.textContent = person.Name;
            
            var role = document.createElement('div');
            role.className = 'cast-role';
            role.textContent = person.Role || person.Type;
            
            castCard.appendChild(img);
            castCard.appendChild(name);
            castCard.appendChild(role);
            
            elements.castList.appendChild(castCard);
        });
    }

    function loadSeasons() {
        var params = {
            userId: auth.userId,
            fields: 'Overview,PrimaryImageAspectRatio'
        };
        
        var endpoint = '/Shows/' + itemData.Id + '/Seasons';
        
        JellyfinAPI.getItems(auth.serverAddress, auth.accessToken, endpoint, params, function(err, data) {
            if (!err && data && data.Items && data.Items.length > 0) {
                displaySeasons(data.Items);
            }
        });
    }

    function displaySeasons(seasons) {
        elements.seasonsSection.style.display = 'block';
        elements.seasonsList.innerHTML = '';
        
        seasons.forEach(function(season) {
            var seasonCard = document.createElement('div');
            seasonCard.className = 'season-card';
            seasonCard.setAttribute('tabindex', '0');
            
            var img = document.createElement('img');
            img.className = 'season-image';
            if (season.ImageTags && season.ImageTags.Primary) {
                img.src = auth.serverAddress + '/Items/' + season.Id + '/Images/Primary?quality=90&maxHeight=400';
            }
            
            var name = document.createElement('div');
            name.className = 'season-name';
            name.textContent = season.Name;
            
            var episodes = document.createElement('div');
            episodes.className = 'season-episodes';
            episodes.textContent = (season.ChildCount || 0) + ' episodes';
            
            seasonCard.appendChild(img);
            seasonCard.appendChild(name);
            seasonCard.appendChild(episodes);
            
            seasonCard.addEventListener('click', function() {
                window.location.href = 'details.html?id=' + season.Id;
            });
            
            elements.seasonsList.appendChild(seasonCard);
        });
    }

    function loadSimilarItems() {
        var params = {
            userId: auth.userId,
            limit: 12,
            fields: 'PrimaryImageAspectRatio'
        };
        
        var endpoint = '/Items/' + itemData.Id + '/Similar';
        
        JellyfinAPI.getItems(auth.serverAddress, auth.accessToken, endpoint, params, function(err, data) {
            if (!err && data && data.Items && data.Items.length > 0) {
                displaySimilarItems(data.Items);
            }
        });
    }

    function displaySimilarItems(items) {
        elements.similarSection.style.display = 'block';
        elements.similarList.innerHTML = '';
        
        items.forEach(function(item) {
            var card = document.createElement('div');
            card.className = 'similar-card';
            card.setAttribute('tabindex', '0');
            
            var img = document.createElement('img');
            img.className = 'similar-image';
            if (item.ImageTags && item.ImageTags.Primary) {
                img.src = auth.serverAddress + '/Items/' + item.Id + '/Images/Primary?quality=90&maxHeight=400';
            }
            
            var title = document.createElement('div');
            title.className = 'similar-title';
            title.textContent = item.Name;
            
            card.appendChild(img);
            card.appendChild(title);
            
            card.addEventListener('click', function() {
                window.location.href = 'details.html?id=' + item.Id;
            });
            
            elements.similarList.appendChild(card);
        });
    }

    function displayTechnicalDetails() {
        elements.technicalSection.style.display = 'block';
        var html = '';
        
        if (itemData.Studios && itemData.Studios.length > 0) {
            html += '<div class="tech-row"><span class="tech-label">Studio:</span><span class="tech-value">' + itemData.Studios.map(s => s.Name).join(', ') + '</span></div>';
        }
        
        if (itemData.PremiereDate) {
            var date = new Date(itemData.PremiereDate);
            html += '<div class="tech-row"><span class="tech-label">Release Date:</span><span class="tech-value">' + date.toLocaleDateString() + '</span></div>';
        }
        
        if (itemData.ProviderIds) {
            if (itemData.ProviderIds.Imdb) {
                html += '<div class="tech-row"><span class="tech-label">IMDb:</span><span class="tech-value">' + itemData.ProviderIds.Imdb + '</span></div>';
            }
        }
        
        elements.technicalDetails.innerHTML = html;
    }

    function handlePlay() {
        JellyfinAPI.Logger.info('Play clicked for item:', itemData.Id);
        alert('Playback not yet implemented');
    }

    function handleResume() {
        JellyfinAPI.Logger.info('Resume clicked for item:', itemData.Id);
        alert('Resume playback not yet implemented');
    }

    function handleTrailer() {
        JellyfinAPI.Logger.info('Trailer clicked for item:', itemData.Id);
        alert('Trailer playback not yet implemented');
    }

    function handleFavorite() {
        var isFavorite = itemData.UserData && itemData.UserData.IsFavorite;
        var newState = !isFavorite;
        
        JellyfinAPI.setFavorite(auth.serverAddress, auth.userId, auth.accessToken, itemData.Id, newState, function(err) {
            if (!err) {
                itemData.UserData.IsFavorite = newState;
                elements.favoriteIcon.textContent = newState ? '♥' : '♡';
                JellyfinAPI.Logger.success('Favorite toggled:', newState);
            }
        });
    }

    function handleMarkPlayed() {
        var isPlayed = itemData.UserData && itemData.UserData.Played;
        var newState = !isPlayed;
        
        JellyfinAPI.setPlayed(auth.serverAddress, auth.userId, auth.accessToken, itemData.Id, newState, function(err) {
            if (!err) {
                itemData.UserData.Played = newState;
                elements.playedText.textContent = newState ? 'Mark Unplayed' : 'Mark Played';
                JellyfinAPI.Logger.success('Played status toggled:', newState);
            }
        });
    }

    function goBack() {
        window.history.back();
    }

    function showLoading() {
        elements.loadingIndicator.style.display = 'flex';
        document.querySelector('.details-container').style.display = 'none';
    }

    function hideLoading() {
        elements.loadingIndicator.style.display = 'none';
        document.querySelector('.details-container').style.display = 'block';
    }

    function showError(message) {
        hideLoading();
        elements.errorText.textContent = message;
        elements.errorDisplay.style.display = 'flex';
        document.querySelector('.details-container').style.display = 'none';
    }

    return {
        init: init
    };
})();

window.addEventListener('load', function() {
    DetailsController.init();
});
