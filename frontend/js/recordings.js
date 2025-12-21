/**
 * Recordings Management Module
 * Manages Live TV recordings, scheduled recordings, and series recordings
 * Supports dual-mode navigation (tabs/grid) and recording operations (play, delete, cancel)
 * @module RecordingsManagement
 */

(function() {
    'use strict';

    const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="600"%3E%3Crect width="400" height="600" fill="%23333"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="24" fill="%23666" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E';

    // State management
    let recordings = [];
    let scheduledRecordings = [];
    let seriesRecordings = [];
    let focusedElement = null;
    let currentTab = 'recordings';
    /** @type {('tabs'|'grid')} Navigation mode */
    let focusMode = 'tabs';

    // Initialize
    document.addEventListener('DOMContentLoaded', function() {
        console.log('Recordings page initializing...');
        setupEventListeners();
        loadRecordings();
    });

    // Setup event listeners
    function setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });

        // Keyboard navigation
        document.addEventListener('keydown', handleKeyPress);

        // Popup buttons
        document.getElementById('popupCloseBtn').addEventListener('click', closePopup);
        document.getElementById('popupPlayBtn').addEventListener('click', handlePlayRecording);
        document.getElementById('popupDeleteBtn').addEventListener('click', handleDeleteRecording);

        // Confirm modal buttons
        document.getElementById('confirmCancelBtn').addEventListener('click', closeConfirmModal);
        document.getElementById('confirmOkBtn').addEventListener('click', confirmAction);

        // Sort change
        document.getElementById('recordingsSort').addEventListener('change', (e) => {
            sortRecordings(e.target.value);
        });
    }

    /**
     * Handle keyboard navigation
     * Supports dual-mode navigation between tabs/controls and grid items
     */
    function handleKeyPress(event) {
        const keyCode = event.keyCode;

        // Close popup if open
        const popup = document.getElementById('recordingDetailPopup');
        const confirmModal = document.getElementById('confirmModal');
        
        if (popup.style.display !== 'none') {
            if (keyCode === KeyCodes.BACK || keyCode === KeyCodes.ESC) {
                event.preventDefault();
                closePopup();
                return;
            }
            // Handle navigation within popup
            if (keyCode === KeyCodes.UP || keyCode === KeyCodes.DOWN || 
                keyCode === KeyCodes.LEFT || keyCode === KeyCodes.RIGHT) {
                event.preventDefault();
                handlePopupNavigation(keyCode);
                return;
            }
            if (keyCode === KeyCodes.OK || keyCode === KeyCodes.ENTER) {
                event.preventDefault();
                handlePopupOK();
                return;
            }
            return;
        }

        if (confirmModal.style.display !== 'none') {
            if (keyCode === KeyCodes.BACK || keyCode === KeyCodes.ESC) {
                event.preventDefault();
                closeConfirmModal();
                return;
            }
            return;
        }

        // Handle navigation based on focus mode
        if (focusMode === 'tabs') {
            if (keyCode === KeyCodes.UP) {
                event.preventDefault();
            } else if (keyCode === KeyCodes.DOWN) {
                event.preventDefault();
                // Move to grid
                focusMode = 'grid';
                const firstItem = getFirstGridItem();
                if (firstItem) {
                    setFocus(firstItem);
                }
            } else if (keyCode === KeyCodes.LEFT) {
                event.preventDefault();
                console.log('[recordings] LEFT in tabs mode');
                navigateTabControls(-1);
            } else if (keyCode === KeyCodes.RIGHT) {
                event.preventDefault();
                console.log('[recordings] RIGHT in tabs mode');
                navigateTabControls(1);
            } else if (keyCode === KeyCodes.OK || keyCode === KeyCodes.ENTER) {
                event.preventDefault();
                const focused = document.activeElement;
                if (focused) {
                    if (focused.classList.contains('tab')) {
                        switchTab(focused.dataset.tab);
                    } else if (focused.tagName === 'SELECT') {
                        // Let select handle its own interaction
                        return;
                    }
                }
            } else if (keyCode === KeyCodes.BACK) {
                event.preventDefault();
                window.location.href = 'live-tv.html';
            }
        } else {
            // Grid navigation
            if (keyCode === KeyCodes.LEFT) {
                event.preventDefault();
                navigateHorizontal(-1);
            } else if (keyCode === KeyCodes.RIGHT) {
                event.preventDefault();
                navigateHorizontal(1);
            } else if (keyCode === KeyCodes.UP) {
                event.preventDefault();
                const result = navigateVertical(-1);
                // If at top of grid, move to tabs
                if (result === 'top') {
                    focusMode = 'tabs';
                    focusFirstTab();
                }
            } else if (keyCode === KeyCodes.DOWN) {
                event.preventDefault();
                console.log('[recordings] DOWN in grid mode');
                navigateVertical(1);
            } else if (keyCode === KeyCodes.OK || keyCode === KeyCodes.ENTER) {
                event.preventDefault();
                if (focusedElement) {
                    focusedElement.click();
                }
            } else if (keyCode === KeyCodes.BACK) {
                event.preventDefault();
                window.location.href = 'live-tv.html';
            }
        }
    }

    /**
     * Navigate horizontally between grid items in the same row
     * @param {number} direction - Direction (-1 left, 1 right)
     */
    function navigateHorizontal(direction) {
        let items;
        
        if (currentTab === 'recordings') {
            items = Array.from(document.querySelectorAll('.recording-card'));
        } else if (currentTab === 'scheduled') {
            items = Array.from(document.querySelectorAll('.scheduled-item'));
        } else if (currentTab === 'series') {
            items = Array.from(document.querySelectorAll('.series-item'));
        }

        if (!items || items.length === 0) return;

        let currentIndex = focusedElement ? items.indexOf(focusedElement) : -1;
        if (currentIndex === -1) return;

        const newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < items.length) {
            setFocus(items[newIndex]);
            items[newIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /**
     * Navigate vertically through grid items
     * @param {number} direction - Direction (-1 up, 1 down)
     * @returns {string|undefined} Returns 'top' if at first item and trying to go up
     */
    function navigateVertical(direction) {
        let items;
        
        if (currentTab === 'recordings') {
            items = Array.from(document.querySelectorAll('.recording-card'));
        } else if (currentTab === 'scheduled') {
            items = Array.from(document.querySelectorAll('.scheduled-item'));
        } else if (currentTab === 'series') {
            items = Array.from(document.querySelectorAll('.series-item'));
        }

        if (!items || items.length === 0) return;

        let currentIndex = focusedElement ? items.indexOf(focusedElement) : -1;

        if (currentIndex === -1) {
            setFocus(items[0]);
        } else {
            // Check if trying to go up from first item
            if (direction === -1 && currentIndex === 0) {
                return 'top';
            }
            
            const newIndex = currentIndex + direction;
            if (newIndex >= 0 && newIndex < items.length) {
                setFocus(items[newIndex]);
                items[newIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    /**
     * Set focus on an element (recording card, scheduled item, etc.)
     * @param {HTMLElement} element - Element to focus
     */
    function setFocus(element) {
        if (focusedElement) {
            focusedElement.classList.remove('focused');
        }
        focusedElement = element;
        if (focusedElement) {
            focusedElement.classList.add('focused');
        }
    }

    // Get tab controls (tabs + sort select on same horizontal level)
    function getTabControls() {
        const tabs = Array.from(document.querySelectorAll('.tab'));
        const sortSelect = document.getElementById('recordingsSort');
        return [...tabs, sortSelect].filter(el => el);
    }

    /**
     * Focus the first tab button
     */
    function focusFirstTab() {
        const tabs = document.querySelectorAll('.tab');
        if (tabs.length > 0) {
            tabs[0].focus();
        }
    }

    /**
     * Navigate through tab controls (tabs and sort dropdown)
     * @param {number} direction - Direction (-1 left, 1 right)
     */
    function navigateTabControls(direction) {
        const controls = getTabControls();
        if (controls.length === 0) return;

        let currentIndex = controls.findIndex(el => document.activeElement === el);
        if (currentIndex === -1) currentIndex = 0;

        currentIndex = (currentIndex + direction + controls.length) % controls.length;
        controls[currentIndex].focus();
    }

    // Get first item in current grid
    function getFirstGridItem() {
        let items;
        
        if (currentTab === 'recordings') {
            items = Array.from(document.querySelectorAll('.recording-card'));
        } else if (currentTab === 'scheduled') {
            items = Array.from(document.querySelectorAll('.scheduled-item'));
        } else if (currentTab === 'series') {
            items = Array.from(document.querySelectorAll('.series-item'));
        }

        return items && items.length > 0 ? items[0] : null;
    }

    // Switch tab
    function switchTab(tabName) {
        currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            }
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName + 'Tab').classList.add('active');

        // Load data if needed
        if (tabName === 'recordings' && recordings.length === 0) {
            loadRecordings();
        } else if (tabName === 'scheduled' && scheduledRecordings.length === 0) {
            loadScheduledRecordings();
        } else if (tabName === 'series' && seriesRecordings.length === 0) {
            loadSeriesRecordings();
        }

        // Reset focus
        focusedElement = null;
    }

    // Load recordings
    function loadRecordings() {
        showLoading(true);

        JellyfinAPI.getLiveTVRecordings((err, response) => {
            showLoading(false);

            if (err) {
                console.error('Failed to load recordings:', err);
                showEmptyState('recordingsGrid', 'No recordings found', 'Start recording programs from the Live TV Guide');
                return;
            }

            recordings = response.Items || [];
            renderRecordings();
        });
    }

    // Render recordings
    function renderRecordings() {
        const grid = document.getElementById('recordingsGrid');
        grid.innerHTML = '';

        if (recordings.length === 0) {
            showEmptyState('recordingsGrid', 'No recordings found', 'Start recording programs from the Live TV Guide');
            return;
        }

        recordings.forEach(recording => {
            const card = createRecordingCard(recording);
            grid.appendChild(card);
        });

        // Set focus on first item
        setTimeout(() => {
            const firstCard = grid.querySelector('.recording-card');
            if (firstCard) setFocus(firstCard);
        }, 100);
    }

    // Create recording card
    function createRecordingCard(recording) {
        const card = document.createElement('div');
        card.className = 'recording-card';
        card.dataset.recordingId = recording.Id;

        // Image
        const img = document.createElement('img');
        img.className = 'recording-card-image';
        
        const auth = JellyfinAPI.getStoredAuth();
        if (recording.ImageTags && recording.ImageTags.Primary && auth) {
            img.src = auth.serverAddress + '/Items/' + recording.Id + '/Images/Primary?maxWidth=400&quality=90';
        } else if (recording.SeriesId && auth) {
            img.src = auth.serverAddress + '/Items/' + recording.SeriesId + '/Images/Primary?maxWidth=400&quality=90';
        } else {
            img.src = PLACEHOLDER_IMAGE;
        }
        img.onerror = () => img.src = PLACEHOLDER_IMAGE;

        // Info
        const info = document.createElement('div');
        info.className = 'recording-card-info';

        const title = document.createElement('div');
        title.className = 'recording-card-title';
        title.textContent = recording.Name || 'Unknown';

        const episode = document.createElement('div');
        episode.className = 'recording-card-episode';
        if (recording.SeriesName && recording.SeriesName !== recording.Name) {
            episode.textContent = recording.SeriesName;
        } else if (recording.EpisodeTitle) {
            episode.textContent = recording.EpisodeTitle;
        } else {
            episode.textContent = '\u00A0'; // Non-breaking space
        }

        const meta = document.createElement('div');
        meta.className = 'recording-card-meta';

        const date = document.createElement('span');
        if (recording.StartDate) {
            const recordDate = new Date(recording.StartDate);
            date.textContent = recordDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        const channel = document.createElement('span');
        channel.textContent = recording.ChannelName || '';

        meta.appendChild(date);
        meta.appendChild(channel);

        info.appendChild(title);
        info.appendChild(episode);
        info.appendChild(meta);

        // Badge if new
        if (recording.IsNew) {
            const badge = document.createElement('div');
            badge.className = 'recording-badge';
            badge.textContent = 'NEW';
            card.appendChild(badge);
        }

        card.appendChild(img);
        card.appendChild(info);

        // Click handler
        card.addEventListener('click', () => showRecordingDetail(recording));

        return card;
    }

    // Sort recordings
    function sortRecordings(sortBy) {
        switch (sortBy) {
            case 'date':
                recordings.sort((a, b) => new Date(b.StartDate) - new Date(a.StartDate));
                break;
            case 'name':
                recordings.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
                break;
            case 'channel':
                recordings.sort((a, b) => (a.ChannelName || '').localeCompare(b.ChannelName || ''));
                break;
        }
        renderRecordings();
    }

    // Load scheduled recordings
    function loadScheduledRecordings() {
        showLoading(true);

        JellyfinAPI.getRecordingTimers((err, timers) => {
            showLoading(false);

            if (err) {
                console.error('Failed to load scheduled recordings:', err);
                showEmptyState('scheduledList', 'No scheduled recordings', 'Schedule recordings from the Live TV Guide');
                return;
            }

            scheduledRecordings = timers || [];
            renderScheduledRecordings();
        });
    }

    // Render scheduled recordings
    function renderScheduledRecordings() {
        const list = document.getElementById('scheduledList');
        list.innerHTML = '';

        if (scheduledRecordings.length === 0) {
            showEmptyState('scheduledList', 'No scheduled recordings', 'Schedule recordings from the Live TV Guide');
            return;
        }

        scheduledRecordings.forEach(timer => {
            const item = createScheduledItem(timer);
            list.appendChild(item);
        });

        // Set focus on first item
        setTimeout(() => {
            const firstItem = list.querySelector('.scheduled-item');
            if (firstItem) setFocus(firstItem);
        }, 100);
    }

    // Create scheduled item
    function createScheduledItem(timer) {
        const item = document.createElement('div');
        item.className = 'scheduled-item';
        item.dataset.timerId = timer.Id;

        const info = document.createElement('div');
        info.className = 'scheduled-item-info';

        const title = document.createElement('div');
        title.className = 'scheduled-item-title';
        title.textContent = timer.Name || 'Unknown';

        const details = document.createElement('div');
        details.className = 'scheduled-item-details';
        details.textContent = timer.ChannelName || '';

        const time = document.createElement('div');
        time.className = 'scheduled-item-time';
        if (timer.StartDate) {
            const startDate = new Date(timer.StartDate);
            time.textContent = startDate.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }

        info.appendChild(title);
        info.appendChild(details);
        info.appendChild(time);

        const actions = document.createElement('div');
        actions.className = 'scheduled-item-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'scheduled-item-btn cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cancelScheduledRecording(timer.Id);
        });

        actions.appendChild(cancelBtn);

        item.appendChild(info);
        item.appendChild(actions);

        return item;
    }

    // Load series recordings
    function loadSeriesRecordings() {
        showLoading(true);

        JellyfinAPI.getSeriesTimers((err, timers) => {
            showLoading(false);

            if (err) {
                console.error('Failed to load series recordings:', err);
                showEmptyState('seriesList', 'No series recordings', 'Series recordings record entire TV series automatically');
                return;
            }

            seriesRecordings = timers || [];
            renderSeriesRecordings();
        });
    }

    // Render series recordings
    function renderSeriesRecordings() {
        const list = document.getElementById('seriesList');
        list.innerHTML = '';

        if (seriesRecordings.length === 0) {
            showEmptyState('seriesList', 'No series recordings', 'Series recordings record entire TV series automatically');
            return;
        }

        seriesRecordings.forEach(timer => {
            const item = createSeriesItem(timer);
            list.appendChild(item);
        });

        // Set focus on first item
        setTimeout(() => {
            const firstItem = list.querySelector('.series-item');
            if (firstItem) setFocus(firstItem);
        }, 100);
    }

    // Create series item
    function createSeriesItem(timer) {
        const item = document.createElement('div');
        item.className = 'series-item';
        item.dataset.timerId = timer.Id;

        // Image
        const auth = JellyfinAPI.getStoredAuth();
        const img = document.createElement('img');
        img.className = 'series-item-image';
        if (timer.SeriesId && auth) {
            img.src = auth.serverAddress + '/Items/' + timer.SeriesId + '/Images/Primary?maxWidth=200&quality=90';
        } else {
            img.src = PLACEHOLDER_IMAGE;
        }
        img.onerror = () => img.src = PLACEHOLDER_IMAGE;

        const info = document.createElement('div');
        info.className = 'series-item-info';

        const title = document.createElement('div');
        title.className = 'series-item-title';
        title.textContent = timer.Name || 'Unknown';

        const channel = document.createElement('div');
        channel.className = 'series-item-channel';
        channel.textContent = timer.ChannelName || '';

        const schedule = document.createElement('div');
        schedule.className = 'series-item-schedule';
        schedule.textContent = getRecordingSchedule(timer);

        const count = document.createElement('div');
        count.className = 'series-item-count';
        count.textContent = timer.RecordingCount ? `${timer.RecordingCount} recordings` : 'No recordings yet';

        info.appendChild(title);
        info.appendChild(channel);
        info.appendChild(schedule);
        info.appendChild(count);

        item.appendChild(img);
        item.appendChild(info);

        return item;
    }

    // Get recording schedule text
    function getRecordingSchedule(timer) {
        const days = timer.DayPattern || '';
        if (days === 'Daily') return 'Records daily';
        if (days === 'Weekdays') return 'Records weekdays';
        if (days === 'Weekends') return 'Records weekends';
        return 'Records when available';
    }

    // Show recording detail
    function showRecordingDetail(recording) {
        // Update popup content
        let title = recording.Name || 'Unknown';
        if (recording.ParentIndexNumber && recording.IndexNumber) {
            title += ' - S' + recording.ParentIndexNumber + 'E' + recording.IndexNumber;
        }
        document.getElementById('popupTitle').textContent = title;

        // Subtitle
        const subtitle = document.getElementById('popupSubtitle');
        if (recording.SeriesName && recording.SeriesName !== recording.Name) {
            subtitle.textContent = recording.SeriesName;
            subtitle.style.display = 'block';
        } else if (recording.EpisodeTitle) {
            subtitle.textContent = recording.EpisodeTitle;
            subtitle.style.display = 'block';
        } else {
            subtitle.style.display = 'none';
        }

        // Time/Duration
        let timeText = '';
        if (recording.StartDate && recording.EndDate) {
            const start = new Date(recording.StartDate);
            const end = new Date(recording.EndDate);
            const duration = Math.round((end - start) / (1000 * 60));
            timeText = `${duration} minutes`;
        }
        document.getElementById('popupTime').textContent = timeText;

        // Overview
        document.getElementById('popupOverview').textContent = recording.Overview || 'No description available.';

        // Image
        const img = document.getElementById('popupImage');
        const auth = JellyfinAPI.getStoredAuth();
        if (recording.ImageTags && recording.ImageTags.Primary && auth) {
            img.src = auth.serverAddress + '/Items/' + recording.Id + '/Images/Primary?maxWidth=300&quality=90';
            img.style.display = 'block';
        } else if (recording.SeriesId && auth) {
            img.src = auth.serverAddress + '/Items/' + recording.SeriesId + '/Images/Primary?maxWidth=300&quality=90';
            img.style.display = 'block';
        } else {
            img.style.display = 'none';
        }

        // Metadata
        document.getElementById('popupChannel').textContent = recording.ChannelName || 'Unknown';

        if (recording.StartDate) {
            const recordDate = new Date(recording.StartDate);
            document.getElementById('popupDate').textContent = recordDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            document.getElementById('popupDateContainer').style.display = 'flex';
        }

        if (recording.ProductionYear) {
            document.getElementById('popupYear').textContent = recording.ProductionYear;
            document.getElementById('popupYearContainer').style.display = 'flex';
        } else {
            document.getElementById('popupYearContainer').style.display = 'none';
        }

        if (recording.OfficialRating) {
            document.getElementById('popupRating').textContent = recording.OfficialRating;
            document.getElementById('popupRatingContainer').style.display = 'flex';
        } else {
            document.getElementById('popupRatingContainer').style.display = 'none';
        }

        if (recording.Genres && recording.Genres.length > 0) {
            document.getElementById('popupGenres').textContent = recording.Genres.join(', ');
            document.getElementById('popupGenresContainer').style.display = 'flex';
        } else {
            document.getElementById('popupGenresContainer').style.display = 'none';
        }

        // Set recording ID for actions
        document.getElementById('popupPlayBtn').dataset.recordingId = recording.Id;
        document.getElementById('popupDeleteBtn').dataset.recordingId = recording.Id;

        // Show popup
        document.getElementById('recordingDetailPopup').style.display = 'flex';
        
        // Focus first button
        setTimeout(() => {
            focusFirstPopupButton();
        }, 100);
    }

    // Close popup
    function closePopup() {
        document.getElementById('recordingDetailPopup').style.display = 'none';
        // Return focus to grid
        if (focusedElement) {
            focusedElement.focus();
        }
    }

    // Focus first popup button
    function focusFirstPopupButton() {
        const buttons = getPopupButtons();
        if (buttons.length > 0) {
            buttons[0].focus();
            buttons[0].classList.add('popup-btn-focused');
        }
    }

    // Get popup buttons
    function getPopupButtons() {
        return [
            document.getElementById('popupPlayBtn'),
            document.getElementById('popupDeleteBtn'),
            document.getElementById('popupCloseBtn')
        ].filter(btn => btn && btn.style.display !== 'none');
    }

    // Handle popup navigation
    function handlePopupNavigation(keyCode) {
        const buttons = getPopupButtons();
        if (buttons.length === 0) return;

        // Find currently focused button
        let currentIndex = buttons.findIndex(btn => document.activeElement === btn || btn.classList.contains('popup-btn-focused'));
        if (currentIndex === -1) currentIndex = 0;

        // Remove focus class from all buttons
        buttons.forEach(btn => btn.classList.remove('popup-btn-focused'));

        // Navigate based on key
        if (keyCode === KeyCodes.LEFT || keyCode === KeyCodes.UP) {
            currentIndex = (currentIndex - 1 + buttons.length) % buttons.length;
        } else if (keyCode === KeyCodes.RIGHT || keyCode === KeyCodes.DOWN) {
            currentIndex = (currentIndex + 1) % buttons.length;
        }

        // Focus new button
        buttons[currentIndex].focus();
        buttons[currentIndex].classList.add('popup-btn-focused');
    }

    // Handle OK/Enter on popup
    function handlePopupOK() {
        const focused = document.activeElement;
        if (focused && focused.tagName === 'BUTTON') {
            focused.click();
        }
    }

    // Handle play recording
    function handlePlayRecording() {
        const recordingId = document.getElementById('popupPlayBtn').dataset.recordingId;
        if (recordingId) {
            window.location.href = 'player.html?id=' + recordingId + '&mediaType=video';
        }
    }

    // Handle delete recording
    function handleDeleteRecording() {
        const recordingId = document.getElementById('popupDeleteBtn').dataset.recordingId;
        showConfirmModal(
            'Delete Recording',
            'Are you sure you want to delete this recording? This action cannot be undone.',
            () => deleteRecording(recordingId)
        );
    }

    /**
     * Delete a recording from the server
     * @param {string} recordingId - Jellyfin recording ID
     */
    function deleteRecording(recordingId) {
        JellyfinAPI.deleteRecording(recordingId, (err) => {
            if (err) {
                console.error('Failed to delete recording:', err);
                showNotification('Failed to delete recording', 'error');
                return;
            }

            showNotification('Recording deleted', 'success');
            closePopup();

            // Remove from list and re-render
            recordings = recordings.filter(r => r.Id !== recordingId);
            renderRecordings();
        });
    }

    // Cancel scheduled recording
    function cancelScheduledRecording(timerId) {
        showConfirmModal(
            'Cancel Recording',
            'Are you sure you want to cancel this scheduled recording?',
            () => {
                JellyfinAPI.cancelRecordingTimer(timerId, (err) => {
                    if (err) {
                        console.error('Failed to cancel recording:', err);
                        showNotification('Failed to cancel recording', 'error');
                        return;
                    }

                    showNotification('Recording canceled', 'success');

                    // Remove from list and re-render
                    scheduledRecordings = scheduledRecordings.filter(r => r.Id !== timerId);
                    renderScheduledRecordings();
                });
            }
        );
    }

    /**
     * Show confirmation modal dialog
     * @param {string} title - Modal title
     * @param {string} message - Confirmation message
     * @param {Function} callback - Callback to execute on confirmation
     */
    let confirmCallback = null;
    function showConfirmModal(title, message, callback) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        confirmCallback = callback;
        document.getElementById('confirmModal').style.display = 'flex';
    }

    // Close confirm modal
    function closeConfirmModal() {
        document.getElementById('confirmModal').style.display = 'none';
        confirmCallback = null;
    }

    // Confirm action
    function confirmAction() {
        if (confirmCallback) {
            confirmCallback();
        }
        closeConfirmModal();
    }

    // Show empty state
    function showEmptyState(containerId, title, message) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📺</div>
                <div class="empty-state-title">${title}</div>
                <div class="empty-state-message">${message}</div>
            </div>
        `;
    }

    // Show notification
    function showNotification(message, type) {
        let notification = document.getElementById('notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.style.cssText = 'position: fixed; top: 100px; left: 50%; transform: translateX(-50%); ' +
                'padding: 15px 30px; border-radius: 8px; font-size: 18px; z-index: 9999; ' +
                'animation: slideDown 0.3s ease-out;';
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        notification.style.background = type === 'error' ?
            'linear-gradient(135deg, #dc3545, #c82333)' :
            'linear-gradient(135deg, #28a745, #218838)';
        notification.style.display = 'block';

        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }

    // Show/hide loading indicator
    function showLoading(show) {
        document.getElementById('loadingIndicator').style.display = show ? 'flex' : 'none';
    }

})();
