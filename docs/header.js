// Global header management
class HeaderManager {
    constructor() {
        this.currentUser = null;
        this.initHeader();
        this.checkAuthStatus();
    }

    checkAuthStatus() {
        this.currentUser = getCurrentUser();
        this.updateHeaderDisplay();
    }

    initHeader() {
        // Create header if it doesn't exist
        if (!document.querySelector('.app-header')) {
            const header = document.createElement('header');
            header.className = 'app-header';
            document.body.insertBefore(header, document.body.firstChild);
            document.body.classList.add('has-app-header');
        }
        this.renderHeader();
    }

    renderHeader() {
        const header = document.querySelector('.app-header');
        header.innerHTML = `
            <div class="header-content">
                <div class="header-left">
                   <a class="navbar-brand d-flex align-items-center" href="index.html">
                  <img src="images/logo.png" alt="Joy Home Connect" height="40" class="me-2"> 
                
                     </a>
                    <nav class="main-nav">
                        <a class="nav-link" href="about.html">About</a>
                        <a class="nav-link" href="gallery.html">Gallery</a>
                        <a class="nav-link" href="donations.html">Donations</a>
                        <a href="volunteer.html">${this.currentUser && this.currentUser.isAdmin ? 'Admin Dashboard' : 'Volunteer '}</a>
                        ${this.currentUser && !this.currentUser.isAdmin ? '<a href="profile.html">My Profile</a>' : ''}
                    </nav>
                </div>
                <div class="header-right" id="header-auth">
                    <button class="mobile-menu-toggle" onclick="headerManager.toggleMobileMenu()">
                        <span class="hamburger-icon"></span>
                        <span class="hamburger-icon"></span>
                        <span class="hamburger-icon"></span>
                    </button>
                    ${this.renderAuthSection()}
                </div>
            </div>
            <div class="mobile-nav-overlay">
                <nav class="mobile-nav-menu">
                    <a href="about.html">About</a>
                    <a href="gallery.html">Gallery</a>
                    <a href="donations.html">Donations</a>
                    <a href="volunteer.html">${this.currentUser && this.currentUser.isAdmin ? 'Admin Dashboard' : 'Volunteer'}</a>
                    ${this.currentUser && !this.currentUser.isAdmin ? '<a href="profile.html">My Profile</a>' : ''}
                </nav>
                ${this.renderMobileAuthButtons()}
            </div>
        `;
        this.attachEventListeners();
        this.attachMobileMenuEvents();
    }

    toggleMobileMenu() {
        const toggle = document.querySelector('.mobile-menu-toggle');
        const overlay = document.querySelector('.mobile-nav-overlay');
        
        toggle.classList.toggle('active');
        overlay.classList.toggle('active');
        
        // Prevent body scroll when menu is open
        if (overlay.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    renderMobileAuthButtons() {
        if (this.currentUser) {
            return `
                <div class="mobile-auth-buttons">
                    <div style="padding: 20px 0; border-bottom: 1px solid #e5e7eb;">
                        <div style="font-weight: 600; color: #111827; margin-bottom: 5px;">${this.currentUser.name}</div>
                        <div style="font-size: 14px; color: #6b7280;">${this.currentUser.email}</div>
                    </div>
                    <button onclick="headerManager.logout()" style="padding: 12px 20px; background: #ef4444; color: white; border: none; border-radius: 6px; font-size: 16px; cursor: pointer;">Logout</button>
                </div>
            `;
        } else {
            return `
                <div class="mobile-auth-buttons">
                    <a href="login.html" class="login-btn">Login</a>
                    <a href="register.html" class="register-btn">Register</a>
                </div>
            `;
        }
    }

    attachMobileMenuEvents() {
        // Close menu when clicking on nav links
        const mobileNavLinks = document.querySelectorAll('.mobile-nav-menu a');
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                this.closeMobileMenu();
            });
        });

        // Close menu when clicking outside
        const overlay = document.querySelector('.mobile-nav-overlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeMobileMenu();
                }
            });
        }
    }

    closeMobileMenu() {
        const toggle = document.querySelector('.mobile-menu-toggle');
        const overlay = document.querySelector('.mobile-nav-overlay');
        
        if (toggle) toggle.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    renderAuthSection() {
        if (this.currentUser) {
            return `
                <div class="user-profile">
                    <div class="profile-pic-container">
                        <img src="${this.getUserProfilePic()}" alt="Profile" class="profile-pic">
                    </div>
                    <div class="user-info">
                        <span class="user-name">${this.currentUser.name}</span>
                        <span class="user-email">${this.currentUser.email}</span>
                    </div>
                    <div class="user-actions">

                        <button onclick="headerManager.logout()" class="logout-btn">Logout</button>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="auth-buttons">
                    <a href="login.html" class="login-btn">Login</a>
                    <a href="register.html" class="register-btn">Register</a>
                </div>
            `;
        }
    }

    getUserProfilePic() {
        if (!this.currentUser) return getUserProfilePic(null, false);
        return getUserProfilePic(this.currentUser.id, this.currentUser.isAdmin);
    }

    updateHeaderDisplay() {
        const header = document.querySelector('.app-header');
        if (header) {
            //  header.innerHTML =
            this.renderHeader();
            this.attachEventListeners();
        }
    }

    attachEventListeners() {
        // Refresh auth status when returning to tab
        const runAuth = () => this.checkAuthStatus();
        window.removeEventListener('focus', runAuth);
        window.addEventListener('focus', runAuth);
    }

    showProfileMenu() {
        // Simple profile menu for now
        const actions = [
            'Change Profile Picture',
            'View Profile', 
            // 'Settings'
        ];
        
        const choice = prompt(`Profile Menu:\n${actions.map((a,i) => `${i+1}. ${a}`).join('\n')}\n\nEnter number:`);
        
        if (choice === '1') {
            this.changeProfilePicture();
        } else if (choice === '2'){
location.href = 'profile.html'
        } 
//         else if (choice === '3'){
// location.href = 'profile.html'
//         }
    }

    changeProfilePicture() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/jpeg,image/jpg,image/png';
        input.style.display = 'none';
        
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.size < 1024 * 1024) { // 1MB limit
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageData = e.target.result;
                    localStorage.setItem(`profile_pic_${this.currentUser.id}`, imageData);
                    this.updateHeaderDisplay();
                    alert('Profile picture updated!');
                };
                reader.readAsDataURL(file);
            } else {
                alert('Please select an image file under 1MB');
            }
        });
        
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
    }

    logout() {
        sessionStorage.removeItem('currentUser');
        localStorage.removeItem('currentUser');
        this.currentUser = null;
        this.updateHeaderDisplay();
        window.location.href = 'index.html';
    }
}

// Global instance
let headerManager;