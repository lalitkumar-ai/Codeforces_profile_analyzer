// Wait for page to fully load
document.addEventListener('DOMContentLoaded', function () {
    console.log('Page loaded, setting up for Codeforces...');

    // Get all elements
    const searchInput = document.getElementById('usernameInput');
    const searchButton = document.getElementById('searchBtn');
    const loadingDiv = document.getElementById('loadingSpinner');
    const errorDiv = document.getElementById('errorMessage');
    const profileDiv = document.getElementById('profileSection');
    const themeButton = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');

    if (!searchInput || !searchButton) {
        console.error('Required elements not found!');
        return;
    }

    // Set up event listeners
    searchButton.addEventListener('click', searchUser);
    searchInput.addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            searchUser();
        }
    });

    themeButton.addEventListener('click', toggleTheme);

    loadTheme();
    console.log('Setup complete!');

    // Main search function for Codeforces
    async function searchUser() {
        const handle = searchInput.value.trim();
        console.log('Searching for Codeforces handle:', handle);

        if (!handle) {
            showError('Please enter a Codeforces handle!');
            return;
        }

        showLoading();
        hideError();
        hideProfile();

        const userInfoUrl = `https://codeforces.com/api/user.info?handles=${handle}`;
        const userStatusUrl = `https://codeforces.com/api/user.status?handle=${handle}&from=1&count=1500`;

        try {
            // Fetch user info and status concurrently
            const [infoResponse, statusResponse] = await Promise.all([
                fetch(userInfoUrl),
                fetch(userStatusUrl)
            ]);

            const userInfo = await infoResponse.json();
            const userStatus = await statusResponse.json();

            // Check for errors in API responses
            if (userInfo.status !== 'OK') {
                throw new Error(userInfo.comment || 'User not found!');
            }
            if (userStatus.status !== 'OK') {
                // This can happen for users with no submissions, not a critical error
                console.warn('Could not fetch user status:', userStatus.comment);
            }

            displayProfile(userInfo.result[0], userStatus.result || []);

        } catch (error) {
            console.error('Error:', error);
            hideLoading();
            showError(error.message);
        }
    }

    // Display profile function
    function displayProfile(user, submissions) {
        console.log('Displaying profile for:', user.handle);
        hideLoading();

        // Basic info
        document.getElementById('userAvatar').src = user.avatar.startsWith('//') ? `https:${user.avatar}` : user.avatar;
        document.getElementById('userName').textContent = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.handle;
        document.getElementById('userLogin').textContent = `@${user.handle}`;
        document.getElementById('userBio').textContent = `Rank: ${user.rank || 'N/A'}`;

        // Main stats
        document.getElementById('userRating').textContent = user.rating || 'Unrated';
        document.getElementById('userMaxRating').textContent = user.maxRating || 'N/A';
        document.getElementById('userFriends').textContent = user.friendOfCount || 0;

        // Optional details
        const locationEl = document.getElementById('userLocation');
        const locationDetail = document.getElementById('locationDetail');
        if (user.country || user.city) {
            locationEl.textContent = [user.city, user.country].filter(Boolean).join(', ');
            locationDetail.style.display = 'flex';
        } else {
            locationDetail.style.display = 'none';
        }

        const companyEl = document.getElementById('userCompany');
        const companyDetail = document.getElementById('companyDetail');
        if (user.organization) {
            companyEl.textContent = user.organization;
            companyDetail.style.display = 'flex';
        } else {
            companyDetail.style.display = 'none';
        }

        document.getElementById('websiteDetail').style.display = 'none'; // Not available in CF API

        // Join date
        const joinDate = new Date(user.registrationTimeSeconds * 1000);
        document.getElementById('userJoined').textContent = 'Joined ' + joinDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long'
        });

        // Show stats based on submissions
        showLanguageStats(submissions);
        showRecentSubmissions(submissions);
        showSubmissionStats(submissions);

        showProfile();
    }

    // Show language stats from submissions
    function showLanguageStats(submissions) {
        const languages = {};
        submissions.forEach(sub => {
            if (sub.programmingLanguage) {
                // Normalize language names slightly
                const lang = sub.programmingLanguage.replace(/GNU C\+\+\d+/, 'C++').replace(/PyPy/, 'Python');
                languages[lang] = (languages[lang] || 0) + 1;
            }
        });

        const languageDiv = document.getElementById('languageStats');
        if (Object.keys(languages).length === 0) {
            languageDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No language data</p>';
            return;
        }

        const sortedLanguages = Object.entries(languages).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const colors = {
            'C++': '#f34b7d', 'Python 3': '#3572A5', 'Java 8': '#b07219', 'C#': '#178600', 'Python': '#3572A5', 'Java': '#b07219'
        };

        languageDiv.innerHTML = '';
        sortedLanguages.forEach(([language, count]) => {
            const item = document.createElement('div');
            item.className = 'language-item';
            const color = colors[language.split(' ')[0]] || '#6366f1'; // Match base language for color
            item.innerHTML = `
                        <div class="language-name">
                            <div class="language-color" style="background-color: ${color}"></div>
                            <span>${language}</span>
                        </div>
                        <span class="language-count">${count}</span>
                    `;
            languageDiv.appendChild(item);
        });
    }

    // Show recent submissions
    function showRecentSubmissions(submissions) {
        const subsDiv = document.getElementById('reposGrid');
        if (!submissions || submissions.length === 0) {
            subsDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center; grid-column: 1 / -1;">No recent submissions found</p>';
            return;
        }

        subsDiv.innerHTML = '';
        // UPDATED: Show up to 100 submissions instead of 6
        submissions.slice(0, 100).forEach(sub => {
            const subCard = document.createElement('div');
            subCard.className = 'repo-card';
            const problem = sub.problem;
            const verdictClass = sub.verdict === 'OK' ? 'verdict-ok' : 'verdict-failed';
            const problemUrl = `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`;

            subCard.innerHTML = `
                        <div class="repo-header">
                            <a href="${problemUrl}" target="_blank" rel="noopener noreferrer" class="repo-name">${problem.name}</a>
                            <span class="repo-visibility ${verdictClass}">${sub.verdict.replace(/_/g, ' ')}</span>
                        </div>
                        <p class="repo-description">Rating: ${problem.rating || 'N/A'}</p>
                        <div class="repo-stats">
                            <div class="repo-language">
                                <span>${sub.programmingLanguage}</span>
                            </div>
                            <div class="repo-stat">
                                <i class="fas fa-clock"></i>
                                <span>${new Date(sub.creationTimeSeconds * 1000).toLocaleDateString()}</span>
                            </div>
                        </div>
                    `;
            subsDiv.appendChild(subCard);
        });
    }

    // Show submission stats
    function showSubmissionStats(submissions) {
        const totalSubmissions = submissions.length;
        const solvedProblems = new Set(submissions.filter(s => s.verdict === 'OK').map(s => s.problem.name)).size;
        const okVerdicts = submissions.filter(s => s.verdict === 'OK').length;
        const successRate = totalSubmissions > 0 ? ((okVerdicts / totalSubmissions) * 100).toFixed(1) : 0;

        // Note: This will show "100" if the user has more than 100 submissions, as that's all we fetch.
        document.getElementById('totalSubmissions').textContent = totalSubmissions.toLocaleString();
        document.getElementById('solvedProblems').textContent = solvedProblems.toLocaleString();
        document.getElementById('successRate').textContent = `${successRate}%`;
    }

    // Theme functions
    function toggleTheme() {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        if (themeIcon) {
            themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    function loadTheme() {
        // Default to dark theme if user has a system preference for it
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const savedTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');

        document.documentElement.setAttribute('data-theme', savedTheme);
        if (themeIcon) {
            themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    // Utility functions
    function showLoading() { if (loadingDiv) loadingDiv.classList.add('show'); }
    function hideLoading() { if (loadingDiv) loadingDiv.classList.remove('show'); }
    function showError(message) {
        const errorText = document.getElementById('errorText');
        if (errorText) errorText.textContent = message;
        if (errorDiv) errorDiv.classList.add('show');
    }
    function hideError() { if (errorDiv) errorDiv.classList.remove('show'); }
    function showProfile() { if (profileDiv) profileDiv.classList.add('show'); }
    function hideProfile() { if (profileDiv) profileDiv.classList.remove('show'); }
});