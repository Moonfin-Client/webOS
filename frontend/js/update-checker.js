/**
 * Update Checker Module
 * Silently checks GitHub releases for newer versions and displays a modal notification
 */
var UpdateChecker = (function() {
    'use strict';

    // GitHub API configuration
    const GITHUB_API_URL = 'https://api.github.com/repos/Moonfin-Client/webOS/releases/latest';
    const CURRENT_VERSION = typeof APP_VERSION !== 'undefined' ? APP_VERSION : '1.0.0';
    
    // Modal state
    var modalElement = null;
    var isModalOpen = false;
    var focusedButtonIndex = 0;
    var previousFocusElement = null;
    var updateInfo = null;

    /**
     * Initialize the update checker
     * Performs a silent GET request to check for updates
     */
    function init() {
        checkForUpdates();
    }

    /**
     * Silently fetch the latest release from GitHub
     * @private
     */
    function checkForUpdates() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', GITHUB_API_URL, true);
        xhr.setRequestHeader('Accept', 'application/vnd.github+json');
        xhr.setRequestHeader('User-Agent', 'Moonfin-webOS-Client');
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        var response = JSON.parse(xhr.responseText);
                        processReleaseData(response);
                    } catch (e) {
                        console.log('[UpdateChecker] Failed to parse response:', e);
                    }
                } else {
                    console.log('[UpdateChecker] Failed to fetch releases, status:', xhr.status);
                }
            }
        };
        
        xhr.onerror = function() {
            console.log('[UpdateChecker] Network error while checking for updates');
        };
        
        xhr.send();
    }

    /**
     * Process the release data and determine if an update is available
     * @param {Object} release - GitHub release object
     * @private
     */
    function processReleaseData(release) {
        if (!release || !release.tag_name) {
            console.log('[UpdateChecker] Invalid release data');
            return;
        }

        var latestVersion = release.tag_name;
        // Remove 'v' prefix if present
        if (latestVersion.charAt(0) === 'v' || latestVersion.charAt(0) === 'V') {
            latestVersion = latestVersion.substring(1);
        }

        console.log('[UpdateChecker] Current version:', CURRENT_VERSION);
        console.log('[UpdateChecker] Latest version:', latestVersion);

        if (isNewerVersion(latestVersion, CURRENT_VERSION)) {
            console.log('[UpdateChecker] Update available!');
            updateInfo = {
                currentVersion: CURRENT_VERSION,
                latestVersion: latestVersion,
                releaseUrl: release.html_url || '',
                releaseNotes: release.body || 'A new version is available. Please visit the GitHub releases page to download.'
            };
            showUpdateModal();
        } else {
            console.log('[UpdateChecker] App is up to date');
        }
    }

    /**
     * Compare two semantic version strings
     * @param {string} latest - Latest version string (e.g., "1.2.0")
     * @param {string} current - Current version string (e.g., "1.0.0")
     * @returns {boolean} True if latest is newer than current
     * @private
     */
    function isNewerVersion(latest, current) {
        var latestParts = latest.split('.').map(function(p) { return parseInt(p, 10) || 0; });
        var currentParts = current.split('.').map(function(p) { return parseInt(p, 10) || 0; });

        // Pad arrays to same length
        var maxLength = Math.max(latestParts.length, currentParts.length);
        while (latestParts.length < maxLength) latestParts.push(0);
        while (currentParts.length < maxLength) currentParts.push(0);

        for (var i = 0; i < maxLength; i++) {
            if (latestParts[i] > currentParts[i]) {
                return true;
            } else if (latestParts[i] < currentParts[i]) {
                return false;
            }
        }

        return false; // Versions are equal
    }

    /**
     * Create and show the update notification modal
     * @private
     */
    function showUpdateModal() {
        if (isModalOpen || !updateInfo) {
            return;
        }

        // Store the currently focused element to restore later
        previousFocusElement = document.activeElement;

        // Create modal HTML
        var modalHtml = 
            '<div class="update-modal-overlay" id="updateModalOverlay">' +
                '<div class="update-modal" id="updateModal" role="dialog" aria-labelledby="updateModalTitle" aria-modal="true">' +
                    '<div class="update-modal-header">' +
                        '<svg class="update-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
                            '<path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" fill="currentColor"/>' +
                        '</svg>' +
                        '<h2 class="update-modal-title" id="updateModalTitle">Update Available</h2>' +
                    '</div>' +
                    '<div class="update-modal-content">' +
                        '<p class="update-version-info">' +
                            'Version <strong>' + escapeHtml(updateInfo.latestVersion) + '</strong> is now available' +
                            '<br><span class="current-version">(Current: ' + escapeHtml(updateInfo.currentVersion) + ')</span>' +
                        '</p>' +
                        '<div class="update-release-notes">' +
                            '<p>' + formatReleaseNotes(updateInfo.releaseNotes) + '</p>' +
                        '</div>' +
                    '</div>' +
                    '<div class="update-modal-buttons">' +
                        '<button class="update-btn update-btn-primary" id="updateOkBtn" tabindex="0">OK</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        // Insert modal into DOM
        var modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        modalElement = modalContainer.firstChild;
        document.body.appendChild(modalElement);

        isModalOpen = true;
        focusedButtonIndex = 0;

        // Set up event listeners
        var okBtn = document.getElementById('updateOkBtn');
        if (okBtn) {
            okBtn.addEventListener('click', closeModal);
            okBtn.focus();
        }

        // Add keyboard handler
        document.addEventListener('keydown', handleModalKeyDown);
    }

    /**
     * Handle keyboard navigation within the modal
     * @param {KeyboardEvent} event
     * @private
     */
    function handleModalKeyDown(event) {
        if (!isModalOpen) {
            return;
        }

        var keyCode = event.keyCode || event.which;
        
        // Handle Enter/OK
        if (keyCode === 13 || keyCode === 461) { // Enter or webOS OK
            event.preventDefault();
            event.stopPropagation();
            closeModal();
            return;
        }

        // Handle Back button
        if (keyCode === 461 || keyCode === 8 || keyCode === 27) { // webOS Back, Backspace, or Escape
            event.preventDefault();
            event.stopPropagation();
            closeModal();
            return;
        }

        // Prevent other navigation while modal is open
        if ([37, 38, 39, 40].indexOf(keyCode) !== -1) { // Arrow keys
            event.preventDefault();
            event.stopPropagation();
        }
    }

    /**
     * Close the update modal and restore focus
     * @private
     */
    function closeModal() {
        if (!isModalOpen) {
            return;
        }

        // Remove keyboard handler
        document.removeEventListener('keydown', handleModalKeyDown);

        // Remove modal from DOM
        if (modalElement && modalElement.parentNode) {
            modalElement.parentNode.removeChild(modalElement);
        }

        modalElement = null;
        isModalOpen = false;
        focusedButtonIndex = 0;

        // Restore focus to previous element
        if (previousFocusElement && typeof previousFocusElement.focus === 'function') {
            setTimeout(function() {
                previousFocusElement.focus();
            }, 100);
        }

        previousFocusElement = null;
    }

    /**
     * Escape HTML special characters to prevent XSS
     * @param {string} text - Raw text
     * @returns {string} Escaped HTML
     * @private
     */
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format release notes for display (truncate if too long)
     * @param {string} notes - Raw release notes
     * @returns {string} Formatted notes
     * @private
     */
    function formatReleaseNotes(notes) {
        if (!notes) {
            return 'A new version is available. Please visit the GitHub releases page to download.';
        }

        // Truncate long notes
        var maxLength = 500;
        var truncated = notes;
        if (notes.length > maxLength) {
            truncated = notes.substring(0, maxLength) + '...';
        }

        // Basic markdown to HTML conversion for common patterns
        truncated = escapeHtml(truncated);
        
        // Convert markdown headers
        truncated = truncated.replace(/^### (.+)$/gm, '<strong>$1</strong>');
        truncated = truncated.replace(/^## (.+)$/gm, '<strong>$1</strong>');
        truncated = truncated.replace(/^# (.+)$/gm, '<strong>$1</strong>');
        
        // Convert bold text
        truncated = truncated.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        
        // Convert line breaks
        truncated = truncated.replace(/\n/g, '<br>');

        return truncated;
    }

    /**
     * Check if the modal is currently open
     * @returns {boolean}
     */
    function isOpen() {
        return isModalOpen;
    }

    // Public API
    return {
        init: init,
        checkForUpdates: checkForUpdates,
        isOpen: isOpen,
        closeModal: closeModal
    };
})();
