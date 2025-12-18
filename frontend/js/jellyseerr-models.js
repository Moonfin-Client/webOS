/*
 * Jellyseerr API Models
 * Data models and validation for Jellyseerr API responses
 */

var JellyseerrModels = (function() {
    'use strict';

    // ==================== Enums & Constants ====================

    /**
     * Request status codes
     */
    const RequestStatus = {
        PENDING: 1,
        APPROVED: 2,
        DECLINED: 3,
        AVAILABLE: 4,

        getLabel: function(status) {
            switch (status) {
                case this.PENDING: return 'Pending';
                case this.APPROVED: return 'Approved';
                case this.DECLINED: return 'Declined';
                case this.AVAILABLE: return 'Available';
                default: return 'Unknown';
            }
        },

        getIcon: function(status) {
            switch (status) {
                case this.PENDING: return '⏳';
                case this.APPROVED: return '✓';
                case this.DECLINED: return '✗';
                case this.AVAILABLE: return '✓';
                default: return '?';
            }
        },

        getColor: function(status) {
            switch (status) {
                case this.PENDING: return '#999999';
                case this.APPROVED: return '#FFFFFF';
                case this.DECLINED: return '#FF0000';
                case this.AVAILABLE: return '#00FF00';
                default: return '#999999';
            }
        }
    };

    /**
     * Media types
     */
    const MediaType = {
        MOVIE: 'movie',
        TV: 'tv',

        isValid: function(type) {
            return type === this.MOVIE || type === this.TV;
        }
    };

    /**
     * Season selection for TV show requests
     */
    const Seasons = {
        /**
         * Create "all seasons" selection
         */
        all: function() {
            return 'all';
        },

        /**
         * Create specific season list
         * @param {number[]} seasonNumbers - Array of season numbers
         */
        list: function(seasonNumbers) {
            if (!Array.isArray(seasonNumbers)) {
                throw new Error('Season list must be an array');
            }
            return seasonNumbers;
        },

        /**
         * Check if value represents "all seasons"
         */
        isAll: function(value) {
            return value === 'all';
        },

        /**
         * Check if value is a valid season selection
         */
        isValid: function(value) {
            return value === 'all' || (Array.isArray(value) && value.length > 0);
        }
    };

    // ==================== Model Factory Functions ====================

    /**
     * Create a JellyseerrRequest model
     */
    function createRequest(data) {
        return {
            id: data.id || 0,
            status: data.status || RequestStatus.PENDING,
            createdAt: data.createdAt || null,
            updatedAt: data.updatedAt || null,
            type: data.type || MediaType.MOVIE,
            media: data.media ? createMedia(data.media) : null,
            requestedBy: data.requestedBy ? createUser(data.requestedBy) : null,
            seasonCount: data.seasonCount || 0,
            seasons: data.seasons || []
        };
    }

    /**
     * Create a JellyseerrMedia model
     */
    function createMedia(data) {
        return {
            id: data.id || 0,
            tmdbId: data.tmdbId || 0,
            tvdbId: data.tvdbId || null,
            imdbId: data.imdbId || null,
            mediaType: data.mediaType || MediaType.MOVIE,
            status: data.status || 1,
            title: data.title || null,
            name: data.name || null,
            posterPath: data.posterPath || null,
            backdropPath: data.backdropPath || null,
            releaseDate: data.releaseDate || null,
            firstAirDate: data.firstAirDate || null
        };
    }

    /**
     * Create a JellyseerrDiscoverItem model
     */
    function createDiscoverItem(data) {
        return {
            id: data.id || 0,
            mediaType: data.mediaType || MediaType.MOVIE,
            popularity: data.popularity || 0,
            title: data.title || null,
            name: data.name || null,
            posterPath: data.posterPath || null,
            backdropPath: data.backdropPath || null,
            overview: data.overview || null,
            releaseDate: data.releaseDate || null,
            firstAirDate: data.firstAirDate || null,
            originalLanguage: data.originalLanguage || null,
            genreIds: data.genreIds || [],
            voteAverage: data.voteAverage || 0,
            voteCount: data.voteCount || 0,
            adult: data.adult || false,
            video: data.video || false,
            originalTitle: data.originalTitle || null,
            originalName: data.originalName || null,
            externalIds: data.externalIds ? createExternalIds(data.externalIds) : null,
            requestList: data.requests ? data.requests.map(createRequest) : []
        };
    }

    /**
     * Create a JellyseerrDiscoverPage model
     */
    function createDiscoverPage(data) {
        return {
            page: data.page || 1,
            totalPages: data.totalPages || 1,
            totalResults: data.totalResults || 0,
            results: data.results ? data.results.map(createDiscoverItem) : []
        };
    }

    /**
     * Create a JellyseerrUser model
     */
    function createUser(data) {
        return {
            id: data.id || 0,
            username: data.username || null,
            email: data.email || null,
            avatar: data.avatar || null,
            apiKey: data.apiKey || null,
            permissions: data.permissions || 0,
            displayName: data.displayName || null
        };
    }

    /**
     * Create a JellyseerrExternalIds model
     */
    function createExternalIds(data) {
        return {
            tvdbId: data.tvdbId || null,
            tmdbId: data.tmdbId || null,
            imdbId: data.imdbId || null
        };
    }

    /**
     * Create a JellyseerrMovieDetails model
     */
    function createMovieDetails(data) {
        return {
            id: data.id || 0,
            title: data.title || '',
            originalTitle: data.originalTitle || null,
            posterPath: data.posterPath || null,
            backdropPath: data.backdropPath || null,
            overview: data.overview || null,
            releaseDate: data.releaseDate || null,
            runtime: data.runtime || 0,
            voteAverage: data.voteAverage || 0,
            voteCount: data.voteCount || 0,
            genres: data.genres ? data.genres.map(createGenre) : [],
            status: data.status || null,
            tagline: data.tagline || null,
            budget: data.budget || 0,
            revenue: data.revenue || 0,
            productionCompanies: data.productionCompanies ? data.productionCompanies.map(createCompany) : [],
            credits: data.credits ? createCredits(data.credits) : null,
            externalIds: data.externalIds ? createExternalIds(data.externalIds) : null,
            mediaInfo: data.mediaInfo ? createMediaInfo(data.mediaInfo) : null
        };
    }

    /**
     * Create a JellyseerrTvDetails model
     */
    function createTvDetails(data) {
        return {
            id: data.id || 0,
            name: data.name || '',
            originalName: data.originalName || null,
            posterPath: data.posterPath || null,
            backdropPath: data.backdropPath || null,
            overview: data.overview || null,
            firstAirDate: data.firstAirDate || null,
            lastAirDate: data.lastAirDate || null,
            numberOfSeasons: data.numberOfSeasons || 0,
            numberOfEpisodes: data.numberOfEpisodes || 0,
            episodeRunTime: data.episodeRunTime || [],
            voteAverage: data.voteAverage || 0,
            voteCount: data.voteCount || 0,
            genres: data.genres ? data.genres.map(createGenre) : [],
            status: data.status || null,
            tagline: data.tagline || null,
            seasons: data.seasons ? data.seasons.map(createSeason) : [],
            credits: data.credits ? createCredits(data.credits) : null,
            externalIds: data.externalIds ? createExternalIds(data.externalIds) : null,
            mediaInfo: data.mediaInfo ? createMediaInfo(data.mediaInfo) : null,
            networks: data.networks ? data.networks.map(createNetwork) : [],
            createdBy: data.createdBy ? data.createdBy.map(createCreator) : []
        };
    }

    /**
     * Create a JellyseerrGenre model
     */
    function createGenre(data) {
        return {
            id: data.id || 0,
            name: data.name || ''
        };
    }

    /**
     * Create a JellyseerrSeason model
     */
    function createSeason(data) {
        return {
            id: data.id || 0,
            seasonNumber: data.seasonNumber || 0,
            name: data.name || '',
            overview: data.overview || null,
            posterPath: data.posterPath || null,
            airDate: data.airDate || null,
            episodeCount: data.episodeCount || 0
        };
    }

    /**
     * Create a JellyseerrCredits model
     */
    function createCredits(data) {
        return {
            cast: data.cast ? data.cast.map(createCastMember) : [],
            crew: data.crew ? data.crew.map(createCrewMember) : []
        };
    }

    /**
     * Create a JellyseerrCastMember model
     */
    function createCastMember(data) {
        return {
            id: data.id || 0,
            name: data.name || '',
            character: data.character || null,
            profilePath: data.profilePath || null,
            order: data.order || 0,
            castId: data.castId || 0
        };
    }

    /**
     * Create a JellyseerrCrewMember model
     */
    function createCrewMember(data) {
        return {
            id: data.id || 0,
            name: data.name || '',
            job: data.job || null,
            department: data.department || null,
            profilePath: data.profilePath || null
        };
    }

    /**
     * Create a JellyseerrCompany model
     */
    function createCompany(data) {
        return {
            id: data.id || 0,
            name: data.name || '',
            logoPath: data.logoPath || null,
            originCountry: data.originCountry || null
        };
    }

    /**
     * Create a JellyseerrNetwork model
     */
    function createNetwork(data) {
        return {
            id: data.id || 0,
            name: data.name || '',
            logoPath: data.logoPath || null,
            originCountry: data.originCountry || null
        };
    }

    /**
     * Create a JellyseerrCreator model
     */
    function createCreator(data) {
        return {
            id: data.id || 0,
            name: data.name || '',
            profilePath: data.profilePath || null
        };
    }

    /**
     * Create a JellyseerrMediaInfo model
     */
    function createMediaInfo(data) {
        return {
            id: data.id || 0,
            tmdbId: data.tmdbId || 0,
            tvdbId: data.tvdbId || null,
            status: data.status || 1,
            requests: data.requests ? data.requests.map(createRequest) : []
        };
    }

    /**
     * Create a JellyseerrPersonDetails model
     */
    function createPersonDetails(data) {
        return {
            id: data.id || 0,
            name: data.name || '',
            biography: data.biography || null,
            birthday: data.birthday || null,
            deathday: data.deathday || null,
            placeOfBirth: data.placeOfBirth || null,
            profilePath: data.profilePath || null,
            knownForDepartment: data.knownForDepartment || null,
            popularity: data.popularity || 0
        };
    }

    /**
     * Create a JellyseerrPersonCombinedCredits model
     */
    function createPersonCombinedCredits(data) {
        return {
            cast: data.cast ? data.cast.map(createDiscoverItem) : [],
            crew: data.crew ? data.crew.map(createDiscoverItem) : []
        };
    }

    /**
     * Create a JellyseerrListResponse model
     */
    function createListResponse(data, itemFactory) {
        return {
            pageInfo: data.pageInfo ? createPageInfo(data.pageInfo) : null,
            results: data.results ? data.results.map(itemFactory) : []
        };
    }

    /**
     * Create a JellyseerrPageInfo model
     */
    function createPageInfo(data) {
        return {
            pages: data.pages || 1,
            pageSize: data.pageSize || 20,
            results: data.results || 0,
            page: data.page || 1
        };
    }

    /**
     * Create a JellyseerrCreateRequest model (for POST body)
     */
    function createRequestBody(mediaId, mediaType, seasons, is4k, profileId, rootFolderId, serverId) {
        const body = {
            mediaId: mediaId,
            mediaType: mediaType
        };

        if (seasons !== null && seasons !== undefined) {
            body.seasons = seasons;
        }

        if (is4k) {
            body.is4k = true;
        }

        if (profileId !== null && profileId !== undefined) {
            body.profileId = profileId;
        }

        if (rootFolderId !== null && rootFolderId !== undefined) {
            body.rootFolderId = rootFolderId;
        }

        if (serverId !== null && serverId !== undefined) {
            body.serverId = serverId;
        }

        return body;
    }

    /**
     * Create a JellyseerrBlacklistItem model
     */
    function createBlacklistItem(data) {
        return {
            id: data.id || 0,
            mediaType: data.mediaType || MediaType.MOVIE,
            tmdbId: data.tmdbId || 0,
            title: data.title || null,
            createdAt: data.createdAt || null
        };
    }

    /**
     * Create a JellyseerrBlacklistPage model
     */
    function createBlacklistPage(data) {
        return {
            pageInfo: data.pageInfo ? createPageInfo(data.pageInfo) : null,
            results: data.results ? data.results.map(createBlacklistItem) : []
        };
    }

    /**
     * Create a JellyseerrStatus model
     */
    function createStatus(data) {
        return {
            appData: data.appData ? {
                version: data.appData.version || null,
                initialized: data.appData.initialized || false
            } : null
        };
    }

    /**
     * Create a JellyseerrRadarrSettings model
     */
    function createRadarrSettings(data) {
        return {
            id: data.id || 0,
            name: data.name || '',
            hostname: data.hostname || '',
            port: data.port || 7878,
            apiKey: data.apiKey || '',
            useSsl: data.useSsl || false,
            baseUrl: data.baseUrl || null,
            activeProfileId: data.activeProfileId || 0,
            activeProfileName: data.activeProfileName || '',
            activeDirectory: data.activeDirectory || '',
            activeAnimeProfileId: data.activeAnimeProfileId || null,
            activeAnimeProfileName: data.activeAnimeProfileName || null,
            activeAnimeDirectory: data.activeAnimeDirectory || null,
            is4k: data.is4k || false,
            minimumAvailability: data.minimumAvailability || 'released',
            isDefault: data.isDefault || false,
            externalUrl: data.externalUrl || null,
            syncEnabled: data.syncEnabled || false,
            preventSearch: data.preventSearch || false,
            tagRequests: data.tagRequests || false,
            tags: data.tags || []
        };
    }

    /**
     * Create a JellyseerrSonarrSettings model
     */
    function createSonarrSettings(data) {
        return {
            id: data.id || 0,
            name: data.name || '',
            hostname: data.hostname || '',
            port: data.port || 8989,
            apiKey: data.apiKey || '',
            useSsl: data.useSsl || false,
            baseUrl: data.baseUrl || null,
            activeProfileId: data.activeProfileId || 0,
            activeProfileName: data.activeProfileName || '',
            activeDirectory: data.activeDirectory || '',
            activeAnimeProfileId: data.activeAnimeProfileId || null,
            activeAnimeProfileName: data.activeAnimeProfileName || null,
            activeAnimeDirectory: data.activeAnimeDirectory || null,
            activeLanguageProfileId: data.activeLanguageProfileId || null,
            is4k: data.is4k || false,
            enableSeasonFolders: data.enableSeasonFolders || false,
            isDefault: data.isDefault || false,
            externalUrl: data.externalUrl || null,
            syncEnabled: data.syncEnabled || false,
            preventSearch: data.preventSearch || false,
            tagRequests: data.tagRequests || false,
            tags: data.tags || []
        };
    }

    // ==================== Validation Helpers ====================

    /**
     * Validate a request object
     */
    function validateRequest(request) {
        const errors = [];

        if (!request.id) {
            errors.push('Request ID is required');
        }

        if (!RequestStatus.getLabel(request.status)) {
            errors.push('Invalid request status');
        }

        if (!MediaType.isValid(request.type)) {
            errors.push('Invalid media type');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validate a discover item
     */
    function validateDiscoverItem(item) {
        const errors = [];

        if (!item.id) {
            errors.push('Item ID is required');
        }

        if (!MediaType.isValid(item.mediaType)) {
            errors.push('Invalid media type');
        }

        if (!item.title && !item.name) {
            errors.push('Title or name is required');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Check if an item is NSFW based on various criteria
     */
    function isNsfw(item) {
        // Check adult flag
        if (item.adult === true) {
            return true;
        }

        // Check for adult genre (10749 is Romance, but combined with adult flag)
        // Genre 10749 alone is not NSFW, but if combined with certain keywords, it might be
        
        // Check overview for NSFW keywords
        if (item.overview) {
            const nsfwKeywords = [
                'erotic', 'pornographic', 'xxx', 'sexual content',
                'explicit', 'adult film', 'adult movie'
            ];
            
            const lowerOverview = item.overview.toLowerCase();
            for (let i = 0; i < nsfwKeywords.length; i++) {
                if (lowerOverview.indexOf(nsfwKeywords[i]) !== -1) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Get display title for an item (handles both movie and TV naming)
     */
    function getDisplayTitle(item) {
        return item.title || item.name || 'Unknown';
    }

    /**
     * Get display year for an item
     */
    function getDisplayYear(item) {
        const dateString = item.releaseDate || item.firstAirDate;
        if (!dateString) return null;

        try {
            return new Date(dateString).getFullYear();
        } catch (e) {
            return null;
        }
    }

    /**
     * Get TMDB poster URL
     */
    function getPosterUrl(posterPath, size) {
        if (!posterPath) return null;
        size = size || 'w500';
        return ImageHelper.getTMDBImageUrl(posterPath, size);
    }

    /**
     * Get TMDB backdrop URL
     */
    function getBackdropUrl(backdropPath, size) {
        if (!backdropPath) return null;
        size = size || 'original';
        return ImageHelper.getTMDBImageUrl(backdropPath, size);
    }

    /**
     * Get TMDB profile URL
     */
    function getProfileUrl(profilePath, size) {
        if (!profilePath) return null;
        size = size || 'w185';
        return ImageHelper.getTMDBImageUrl(profilePath, size);
    }

    /**
     * Format runtime (minutes to hours:minutes)
     */
    function formatRuntime(minutes) {
        if (!minutes || minutes <= 0) return null;
        
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (hours > 0) {
            return hours + 'h ' + mins + 'm';
        } else {
            return mins + 'm';
        }
    }

    /**
     * Format date string to locale format
     */
    function formatDate(dateString) {
        if (!dateString) return null;

        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return dateString;
        }
    }

    /**
     * Check if request is for a specific item
     */
    function hasExistingRequest(item) {
        return item.requestList && item.requestList.length > 0;
    }

    /**
     * Get existing request status for an item
     */
    function getExistingRequestStatus(item) {
        if (!hasExistingRequest(item)) return null;
        
        // Return the most recent request
        const sortedRequests = item.requestList.sort(function(a, b) {
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        return sortedRequests[0].status;
    }

    // ==================== Public API ====================

    return {
        // Enums
        RequestStatus: RequestStatus,
        MediaType: MediaType,
        Seasons: Seasons,

        // Factory functions
        createRequest: createRequest,
        createMedia: createMedia,
        createDiscoverItem: createDiscoverItem,
        createDiscoverPage: createDiscoverPage,
        createUser: createUser,
        createExternalIds: createExternalIds,
        createMovieDetails: createMovieDetails,
        createTvDetails: createTvDetails,
        createGenre: createGenre,
        createSeason: createSeason,
        createCredits: createCredits,
        createCastMember: createCastMember,
        createCrewMember: createCrewMember,
        createCompany: createCompany,
        createNetwork: createNetwork,
        createCreator: createCreator,
        createMediaInfo: createMediaInfo,
        createPersonDetails: createPersonDetails,
        createPersonCombinedCredits: createPersonCombinedCredits,
        createListResponse: createListResponse,
        createPageInfo: createPageInfo,
        createRequestBody: createRequestBody,
        createBlacklistItem: createBlacklistItem,
        createBlacklistPage: createBlacklistPage,
        createStatus: createStatus,
        createRadarrSettings: createRadarrSettings,
        createSonarrSettings: createSonarrSettings,

        // Validators
        validateRequest: validateRequest,
        validateDiscoverItem: validateDiscoverItem,
        isNsfw: isNsfw,

        // Helper functions
        getDisplayTitle: getDisplayTitle,
        getDisplayYear: getDisplayYear,
        getPosterUrl: getPosterUrl,
        getBackdropUrl: getBackdropUrl,
        getProfileUrl: getProfileUrl,
        formatRuntime: formatRuntime,
        formatDate: formatDate,
        hasExistingRequest: hasExistingRequest,
        getExistingRequestStatus: getExistingRequestStatus
    };
})();

// Make available globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JellyseerrModels;
}
