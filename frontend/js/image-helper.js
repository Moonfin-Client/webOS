/**
 * Image Helper Module
 * Handles image URL generation and selection based on user settings
 */
var ImageHelper = (function() {
    'use strict';

    var imageType = 'Primary'; // 'Primary', 'Thumb', or 'Banner'
    var posterSize = 300;
    var preferParentThumb = false;

    /**
     * Set the image type preference
     * @param {string} type - 'Primary', 'Thumb', or 'Banner'
     */
    function setImageType(type) {
        imageType = type;
    }

    /**
     * Set the poster size
     * @param {number} size - Size in pixels
     */
    function setPosterSize(size) {
        posterSize = size;
    }

    /**
     * Set whether to prefer parent thumbnails for episodes
     * @param {boolean} prefer - True to use series artwork for episodes
     */
    function setPreferParentThumb(prefer) {
        preferParentThumb = prefer;
    }

    /**
     * Get the current image type setting
     * @returns {string} Current image type
     */
    function getImageType() {
        return imageType;
    }

    /**
     * Get image URL for an item based on current settings
     * @param {string} serverAddress - Jellyfin server address
     * @param {Object} item - Jellyfin item object
     * @returns {string} Image URL
     */
    function getImageUrl(serverAddress, item) {
        if (!item || !serverAddress) return '';

        var itemId = item.Id;
        var imageTag = null;
        var useParent = false;

        // For episodes, check if we should use parent (series) artwork
        if (item.Type === 'Episode' && preferParentThumb) {
            if (item.SeriesId && item.SeriesPrimaryImageTag) {
                itemId = item.SeriesId;
                imageTag = item.SeriesPrimaryImageTag;
                useParent = true;
            }
        }

        // Determine which image type to use
        var imgType = imageType;
        var hasRequestedType = false;

        if (imageType === 'Primary' && item.ImageTags && item.ImageTags.Primary) {
            hasRequestedType = true;
            imageTag = imageTag || item.ImageTags.Primary;
        } else if (imageType === 'Thumb' && item.ImageTags && item.ImageTags.Thumb) {
            hasRequestedType = true;
            imageTag = item.ImageTags.Thumb;
        } else if (imageType === 'Banner' && item.ImageTags && item.ImageTags.Banner) {
            hasRequestedType = true;
            imageTag = item.ImageTags.Banner;
        }

        // Fallback to Primary if requested type not available
        if (!hasRequestedType) {
            if (item.ImageTags && item.ImageTags.Primary) {
                imgType = 'Primary';
                imageTag = item.ImageTags.Primary;
            } else if (item.ImageTags && item.ImageTags.Thumb) {
                imgType = 'Thumb';
                imageTag = item.ImageTags.Thumb;
            } else if (item.ImageTags && item.ImageTags.Banner) {
                imgType = 'Banner';
                imageTag = item.ImageTags.Banner;
            }
        }

        if (!imageTag) return '';

        // Build URL with appropriate size parameters
        var params = 'quality=90';
        if (imgType === 'Primary' || imgType === 'Thumb') {
            params += '&maxHeight=' + posterSize;
        } else if (imgType === 'Banner') {
            params += '&maxWidth=' + (posterSize * 2);
        }
        params += '&tag=' + imageTag;

        return serverAddress + '/Items/' + itemId + '/Images/' + imgType + '?' + params;
    }

    /**
     * Get placeholder URL for items without images
     * @param {Object} item - Jellyfin item object
     * @param {string} [color='%23333'] - Placeholder color
     * @returns {string} SVG data URL
     */
    function getPlaceholderUrl(item, color) {
        color = color || '%23333';
        var aspect = getAspectRatio(item, imageType);
        
        var width = 200;
        var height = Math.round(width / aspect);
        
        return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" ' +
               'width="' + width + '" height="' + height + '"%3E%3Crect fill="' + color +
               '" width="' + width + '" height="' + height + '"/%3E%3C/svg%3E';
    }

    /**
     * Get aspect ratio for an item based on image type
     * @param {Object} item - Jellyfin item object
     * @param {string} type - Image type
     * @returns {number} Aspect ratio (width/height)
     */
    function getAspectRatio(item, type) {
        // Use PrimaryImageAspectRatio if available
        if (item.PrimaryImageAspectRatio && type === 'Primary') {
            return item.PrimaryImageAspectRatio;
        }

        // Default aspect ratios by type
        if (type === 'Thumb' || type === 'Banner') {
            return 1.78; // 16:9 landscape
        } else {
            // Primary/Poster - portrait
            return 0.667; // 2:3 portrait (common for posters)
        }
    }

    /**
     * Get TMDB image URL
     * @param {string} path - TMDB image path (with leading slash)
     * @param {string} size - Image size (w185, w500, w780, original, etc.)
     * @returns {string|null} Full TMDB image URL or null if no path
     */
    function getTMDBImageUrl(path, size) {
        if (!path) return null;
        
        // Remove leading slash if present
        var cleanPath = path.startsWith('/') ? path : '/' + path;
        
        // Default size if not specified
        var imageSize = size || 'w500';
        
        return 'https://image.tmdb.org/t/p/' + imageSize + cleanPath;
    }

    return {
        setImageType: setImageType,
        setPosterSize: setPosterSize,
        setPreferParentThumb: setPreferParentThumb,
        getImageType: getImageType,
        getImageUrl: getImageUrl,
        getPlaceholderUrl: getPlaceholderUrl,
        getAspectRatio: getAspectRatio,
        getTMDBImageUrl: getTMDBImageUrl
    };
})();
