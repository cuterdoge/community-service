// Shared authentication utilities

// Consolidated function to get current user from either storage
function getCurrentUser() {
    let userInfo = sessionStorage.getItem('currentUser');
    if (!userInfo) {
        userInfo = localStorage.getItem('currentUser');
    }
    return userInfo ? JSON.parse(userInfo) : null;
}

// Save user to appropriate storage
function saveCurrentUser(userInfo, rememberMe = false) {
    if (rememberMe) {
        localStorage.setItem('currentUser', JSON.stringify(userInfo));
        sessionStorage.removeItem('currentUser');
    } else {
        sessionStorage.setItem('currentUser', JSON.stringify(userInfo));
        localStorage.removeItem('currentUser');
    }
}

// Get user profile picture with proper fallback
function getUserProfilePic(userId, isAdmin = false) {
    if (isAdmin) {
        return 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#4f46e5"><path d="M12 1L9 9H1l6.5 5L5 23l7-5 7 5-2.5-9L23 9h-8l-3-8z"/></svg>');
    }
    
    if (userId) {
        const savedPic = localStorage.getItem(`profile_pic_${userId}`);
        if (savedPic) {
            return savedPic;
        }
    }
    
    // Default placeholder - proper base64 encoded SVG
    return 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#999"><circle cx="12" cy="8" r="4"/><path d="M4 20v-2a8 8 0 0116 0v2H4z"/></svg>');
}

// Logout function (clear both storage types)
function logout() {
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('currentUser');
    // Redirect to home page
    window.location.href = 'index.html';
}

// Create logout button element
function createLogoutButton() {
    const currentUser = getCurrentUser();
    if (!currentUser) return '';
    
    return `
        <div class="user-controls">
            <span class="user-welcome">Welcome, ${currentUser.name}</span>
            <button onclick="logout()" class="logout-btn">Logout</button>
        </div>
    `;
}

// Legacy function - now handled by HeaderManager
function addLogoutToPage() {
    // This function is deprecated - HeaderManager handles this now
    console.log('addLogoutToPage() is deprecated - using HeaderManager instead');
}