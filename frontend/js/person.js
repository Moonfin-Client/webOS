/**
 * Person Details Controller
 * Displays person/cast member information and their credits
 */

var PersonController = (function() {
    'use strict';

    // State management
    var state = {
        personId: null,
        personData: null,
        credits: {
            movies: [],
            tvShows: []
        },
        focusContext: 'navbar',
        focusPosition: { section: 0, item: 0 }
    };

    // DOM Elements
    var elements = {};

    /**
     * Initialize the controller
     */
    function init() {
        
        // Cache DOM elements
        cacheElements();
        
        // Load navbar
        if (typeof NavbarController !== 'undefined') {
            NavbarController.init('person');
        }
        
        // Get person ID from URL
        var urlParams = new URLSearchParams(window.location.search);
        state.personId = urlParams.get('id');
        
        if (!state.personId) {
            showError('No person ID provided');
            return;
        }
        
        // Get auth
        var auth = JellyfinAPI.getStoredAuth();
        if (!auth) {
            showError('Not authenticated');
            return;
        }
        
        // Add event listeners
        addEventListeners();
        
        // Load person details from Jellyfin
        loadPersonDetails();
    }

    /**
     * Cache DOM elements
     */
    function cacheElements() {
        elements.loadingIndicator = document.getElementById('loadingIndicator');
        elements.errorMessage = document.getElementById('errorMessage');
        elements.errorText = document.getElementById('errorText');
        elements.backBtn = document.getElementById('backBtn');
        elements.personDetails = document.getElementById('personDetails');
        
        // Person header
        elements.personProfile = document.getElementById('personProfile');
        elements.personProfilePlaceholder = document.getElementById('personProfilePlaceholder');
        elements.personName = document.getElementById('personName');
        elements.knownForContainer = document.getElementById('knownForContainer');
        elements.knownFor = document.getElementById('knownFor');
        elements.birthdayContainer = document.getElementById('birthdayContainer');
        elements.birthday = document.getElementById('birthday');
        elements.ageContainer = document.getElementById('ageContainer');
        elements.age = document.getElementById('age');
        elements.birthplaceContainer = document.getElementById('birthplaceContainer');
        elements.birthplace = document.getElementById('birthplace');
        elements.biographyContainer = document.getElementById('biographyContainer');
        elements.biography = document.getElementById('biography');
        elements.biographyToggle = document.getElementById('biographyToggle');
        
        // Credits sections
        elements.moviesSection = document.getElementById('moviesSection');
        elements.moviesList = document.getElementById('moviesList');
        elements.tvShowsSection = document.getElementById('tvShowsSection');
        elements.tvShowsList = document.getElementById('tvShowsList');
        
        // Backdrop
        elements.globalBackdrop = document.getElementById('globalBackdrop');
        elements.globalBackdropImage = document.getElementById('globalBackdropImage');
    }

    /**
     * Add event listeners
     */
    function addEventListeners() {
        // Keyboard navigation
        document.addEventListener('keydown', handleKeyPress);
        
        // Back button
        elements.backBtn.addEventListener('click', function() {
            window.history.back();
        });
        
        // Biography toggle
        if (elements.biographyToggle) {
            elements.biographyToggle.addEventListener('click', toggleBiography);
        }
    }
    
    /**
     * Toggle biography expanded/collapsed
     */
    function toggleBiography() {
        if (!elements.biography || !elements.biographyToggle) return;
        
        if (elements.biography.classList.contains('collapsed')) {
            elements.biography.classList.remove('collapsed');
            elements.biographyToggle.textContent = 'Show Less';
        } else {
            elements.biography.classList.add('collapsed');
            elements.biographyToggle.textContent = 'Show More';
        }
    }

    /**
     * Load person details from Jellyfin
     */
    function loadPersonDetails() {
        var auth = JellyfinAPI.getStoredAuth();
        if (!auth) {
            showError('Not authenticated');
            return;
        }
        
        // Show loading
        elements.loadingIndicator.style.display = 'flex';
        elements.errorMessage.style.display = 'none';
        elements.personDetails.style.display = 'none';
        
        // Load person details from Jellyfin
        var url = auth.serverAddress + '/Users/' + auth.userId + '/Items/' + state.personId;
        
        JellyfinAPI.getJSON(auth.serverAddress, auth.accessToken, url, function(err, person) {
            if (err || !person) {
                showError('Failed to load person details');
                return;
            }
            
            state.personData = person;
            
            // Load items this person appears in
            loadPersonAppearances();
        });
    }
    
    /**
     * Load items this person appears in
     */
    function loadPersonAppearances() {
        var auth = JellyfinAPI.getStoredAuth();
        if (!auth) return;
        
        var params = {
            PersonIds: state.personId,
            Recursive: true,
            IncludeItemTypes: 'Movie,Series',
            Fields: 'PrimaryImageAspectRatio,MediaSourceCount',
            SortBy: 'SortName',
            SortOrder: 'Ascending'
        };
        
        JellyfinAPI.getItems(
            auth.serverAddress,
            auth.accessToken,
            '/Users/' + auth.userId + '/Items',
            params,
            function(err, data) {
                if (!err && data && data.Items) {
                    processAppearances(data.Items);
                }
                
                // Display person details
                displayPersonDetails();
                
                // Hide loading, show content
                elements.loadingIndicator.style.display = 'none';
                elements.personDetails.style.display = 'block';
            }
        );
    }

    /**
     * Process appearances into movies and TV shows
     */
    function processAppearances(items) {
        state.credits = {
            movies: [],
            tvShows: []
        };
        
        items.forEach(function(item) {
            if (item.Type === 'Movie') {
                state.credits.movies.push(item);
            } else if (item.Type === 'Series') {
                state.credits.tvShows.push(item);
            }
        });
    }

    /**
     * Display person details
     */
    function displayPersonDetails() {
        var person = state.personData;
        
        // Set profile image
        if (person.profilePath) {
            var profileUrl = ImageHelper.getTMDBImageUrl(person.profilePath, 'w500');
            elements.personProfile.src = profileUrl;
            elements.personProfile.style.display = 'block';
            elements.personProfilePlaceholder.style.display = 'none';
            
            // Set backdrop
            if (elements.globalBackdropImage) {
                elements.globalBackdropImage.src = profileUrl;
                elements.globalBackdropImage.style.display = 'block';
            }
        }
        
        // Hide skeleton elements
        var skeletons = document.querySelectorAll('.skeleton-meta, .skeleton-bio, .skeleton-credits, .skeleton-profile, .skeleton-title');
        skeletons.forEach(function(skeleton) {
            skeleton.style.display = 'none';
        });
        
        // Set name
        elements.personName.textContent = person.name || 'Unknown';
        
        // Set known for department
        if (person.knownForDepartment) {
            elements.knownFor.textContent = person.knownForDepartment;
            elements.knownForContainer.style.display = 'flex';
        }
        
        // Set birthday
        if (person.birthday) {
            var birthdayDate = new Date(person.birthday);
            var birthdayStr = birthdayDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            elements.birthday.textContent = birthdayStr;
            elements.birthdayContainer.style.display = 'flex';
        }
        
        var auth = JellyfinAPI.getStoredAuth();
        
        // Set profile image
        if (person.ImageTags && person.ImageTags.Primary) {
            var profileUrl = auth.serverAddress + '/Items/' + person.Id + '/Images/Primary?quality=90';
            elements.personProfile.src = profileUrl;
            elements.personProfile.style.display = 'block';
            elements.personProfilePlaceholder.style.display = 'none';
            
            // Set backdrop
            if (elements.globalBackdropImage) {
                elements.globalBackdropImage.src = profileUrl;
                elements.globalBackdropImage.style.display = 'block';
            }
        }
        
        // Hide skeleton elements
        var skeletons = document.querySelectorAll('.skeleton-meta, .skeleton-bio, .skeleton-credits, .skeleton-profile, .skeleton-title');
        skeletons.forEach(function(skeleton) {
            skeleton.style.display = 'none';
        });
        
        // Set name
        elements.personName.textContent = person.Name || 'Unknown';
        
        // Set known for (based on role)
        if (person.Role) {
            elements.knownFor.textContent = person.Role;
            elements.knownForContainer.style.display = 'flex';
        } else if (person.Type) {
            elements.knownFor.textContent = person.Type;
            elements.knownForContainer.style.display = 'flex';
        }
        
        // Set birth info if available
        if (person.PremiereDate) {
            var birthDate = new Date(person.PremiereDate);
            var birthStr = birthDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            elements.birthday.textContent = birthStr;
            elements.birthdayContainer.style.display = 'flex';
            
            // Calculate age
            var age = calculateAge(person.PremiereDate);
            if (age > 0) {
                elements.age.textContent = age + ' years old';
                elements.ageContainer.style.display = 'flex';
            }
        }
        
        // Set production location as birthplace if available
        if (person.ProductionLocations && person.ProductionLocations.length > 0) {
            elements.birthplace.textContent = person.ProductionLocations.join(', ');
            elements.birthplaceContainer.style.display = 'flex';
        }
        
        // Set overview as biography
        if (person.Overview) {
            elements.biography.textContent = person.Overview;
            elements.biographyContainer.style.display = 'block';
        }
    }

    /**
     * Render credits
     */
    function renderCredits(credits, container, type) {
        container.innerHTML = '';
        
        credits.forEach(function(credit, index) {
            var card = createCreditCard(credit, type, index);
            container.appendChild(card);
        });
    }

    /**
     * Create credit card
     */
    function createCreditCard(credit, type, index) {
        var card = document.createElement('div');
        card.className = 'credit-card';
        card.setAttribute('data-tmdb-id', credit.id);
        card.setAttribute('data-type', type);
        card.setAttribute('data-index', index);
        card.setAttribute('tabindex', '0');
        
        // Poster
        var posterContainer = document.createElement('div');
        posterContainer.className = 'credit-poster-container';
        
        if (credit.posterPath) {
            var poster = document.createElement('img');
            poster.className = 'credit-poster';
            poster.src = ImageHelper.getTMDBImageUrl(credit.posterPath, 'w500');
            poster.alt = credit.title || credit.name || 'Media';
            posterContainer.appendChild(poster);
        } else {
            var placeholder = document.createElement('div');
            placeholder.className = 'credit-poster-placeholder';
            placeholder.textContent = '🎬';
            posterContainer.appendChild(placeholder);
        }
        
        card.appendChild(posterContainer);
        
        // Info
        var info = document.createElement('div');
        info.className = 'credit-info';
        
        var title = document.createElement('div');
        title.className = 'credit-title';
        title.textContent = credit.title || credit.name || 'Unknown';
        info.appendChild(title);
        
        var subtitle = document.createElement('div');
        subtitle.className = 'credit-subtitle';
        
        // Show year or role
        if (credit.releaseDate || credit.firstAirDate) {
            var dateStr = credit.releaseDate || credit.firstAirDate;
            var year = new Date(dateStr).getFullYear();
            subtitle.textContent = year;
        } else if (credit.character) {
            subtitle.textContent = 'as ' + credit.character;
        }
        
        info.appendChild(subtitle);
        card.appendChild(info);
        
        // Click handler
        card.addEventListener('click', function() {
            if (type === 'movie') {
                window.location.href = 'jellyseerr-details.html?type=movie&id=' + credit.id;
            } else {
                window.location.href = 'jellyseerr-details.html?type=tv&id=' + credit.id;
            }
        });
        
        return card;
    }

    /**
     * Show error message
     */
    function showError(message) {
        elements.loading.style.display = 'none';
        elements.personDetails.style.display = 'none';
        elements.errorMessage.style.display = 'flex';
        elements.errorText.textContent = message;
    }

    /**
     * Handle keyboard navigation
     */
    function handleKeyPress(event) {
        var keyCode = event.keyCode;
        
        // Global back button
        if (keyCode === KeyCodes.BACK || keyCode === KeyCodes.BACKSPACE) {
            event.preventDefault();
            window.history.back();
            return;
        }
        
        // Context-specific navigation
        if (state.focusContext === 'navbar') {
            if (keyCode === KeyCodes.DOWN) {
                event.preventDefault();
                focusToCredits();
            }
        } else if (state.focusContext === 'credits') {
            handleCreditsNavigation(event);
        }
    }

    /**
     * Handle credits navigation
     */
    function handleCreditsNavigation(event) {
        var keyCode = event.keyCode;
        var sections = [];
        if (state.credits.movies.length > 0) sections.push('movies');
        if (state.credits.tvShows.length > 0) sections.push('tvShows');
        
        if (sections.length === 0) return;
        
        var currentSection = sections[state.focusPosition.section];
        var currentList = currentSection === 'movies' ? state.credits.movies : state.credits.tvShows;
        
        if (keyCode === KeyCodes.UP) {
            event.preventDefault();
            if (state.focusPosition.section > 0) {
                state.focusPosition.section--;
                state.focusPosition.item = 0;
                focusCreditCard();
            } else {
                focusToNavBar();
            }
        } else if (keyCode === KeyCodes.DOWN) {
            event.preventDefault();
            if (state.focusPosition.section < sections.length - 1) {
                state.focusPosition.section++;
                state.focusPosition.item = 0;
                focusCreditCard();
            }
        } else if (keyCode === KeyCodes.LEFT) {
            event.preventDefault();
            if (state.focusPosition.item > 0) {
                state.focusPosition.item--;
                focusCreditCard();
            }
        } else if (keyCode === KeyCodes.RIGHT) {
            event.preventDefault();
            if (state.focusPosition.item < currentList.length - 1) {
                state.focusPosition.item++;
                focusCreditCard();
            }
        } else if (keyCode === KeyCodes.ENTER || keyCode === KeyCodes.OK) {
            event.preventDefault();
            var credit = currentList[state.focusPosition.item];
            var type = currentSection === 'movies' ? 'movie' : 'tv';
            navigateToMedia(credit, type);
        }
    }

    /**
     * Focus management
     */
    function focusToNavBar() {
        state.focusContext = 'navbar';
        if (typeof NavbarController !== 'undefined' && NavbarController.focusNavbar) {
            NavbarController.focusNavbar();
        }
    }

    function focusToCredits() {
        state.focusContext = 'credits';
        state.focusPosition = { section: 0, item: 0 };
        focusCreditCard();
    }

    function focusCreditCard() {
        var sections = [];
        if (state.credits.movies.length > 0) sections.push('movies');
        if (state.credits.tvShows.length > 0) sections.push('tvShows');
        
        if (sections.length === 0) return;
        
        var sectionName = sections[state.focusPosition.section];
        var container = sectionName === 'movies' ? elements.moviesList : elements.tvShowsList;
        var cards = container.querySelectorAll('.credit-card');
        
        if (cards[state.focusPosition.item]) {
            cards[state.focusPosition.item].focus();
        }
    }

    // Public API
    return {
        init: init
    };
})();

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    PersonController.init();
});
