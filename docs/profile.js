// Profile page functionality
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuthAndLoadProfile();
});

function checkAuthAndLoadProfile() {
    currentUser = getCurrentUser();
    
    if (!currentUser) {
        document.getElementById('login-required').style.display = 'block';
        document.getElementById('profile-page').style.display = 'none';
        return;
    }
    
    if (currentUser.isAdmin) {
        // Redirect admin to admin page
        alert('Admins use the admin panel for management.');
        window.location.href = 'admin.html';
        return;
    }
    
    document.getElementById('login-required').style.display = 'none';
    document.getElementById('profile-page').style.display = 'block';
    
    loadUserProfile();
}

function loadUserProfile() {
    // Load current user data
    document.getElementById('profile-name').value = currentUser.name;
    document.getElementById('profile-email').value = currentUser.email;
    document.getElementById('profile-phone').value = currentUser.phone || '';
    
    // Load profile picture with proper placeholder
    const currentPicElement = document.getElementById('current-profile-pic');
    currentPicElement.src = getUserProfilePic(currentUser.id, currentUser.isAdmin);
}

// Profile form validation
function validateName(name) {
    return name.trim().length >= 2 && /^[a-zA-Z\s]+$/.test(name.trim());
}

function validatePhone(phone) {
    const phoneRegex = /^(\+?6?0)?[0-9\s\-]{8,15}$/;
    return phoneRegex.test(phone.trim());
}

function validatePassword(password) {
    return password.length >= 6;
}

function showError(elementId, message) {
    document.getElementById(elementId).textContent = message;
}

function clearErrors() {
    document.getElementById('name-error').textContent = '';
    document.getElementById('phone-error').textContent = '';
    document.getElementById('current-password-error').textContent = '';
    document.getElementById('new-password-error').textContent = '';
}

// Profile picture change
function changeProfilePicture() {
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
                localStorage.setItem(`profile_pic_${currentUser.id}`, imageData);
                document.getElementById('current-profile-pic').src = imageData;
                
                // Update header if headerManager exists
                if (window.headerManager) {
                    headerManager.updateHeaderDisplay();
                }
                
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

// Profile form submission
document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const name = document.getElementById('profile-name').value.trim();
    const phone = document.getElementById('profile-phone').value.trim();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;

    // Client-side validation
    let hasErrors = false;

    if (!name) {
        showError('name-error', 'Full name is required');
        hasErrors = true;
    } else if (!validateName(name)) {
        showError('name-error', 'Please enter a valid name (letters and spaces only, minimum 2 characters)');
        hasErrors = true;
    }

    if (!phone) {
        showError('phone-error', 'Phone number is required');
        hasErrors = true;
    } else if (!validatePhone(phone)) {
        showError('phone-error', 'Please enter a valid phone number');
        hasErrors = true;
    }

    if (!currentPassword) {
        showError('current-password-error', 'Current password is required to save changes');
        hasErrors = true;
    }

    if (newPassword && !validatePassword(newPassword)) {
        showError('new-password-error', 'New password must be at least 6 characters long');
        hasErrors = true;
    }

    if (hasErrors) return;

    try {
        const updateData = {
            name,
            phone,
            currentPassword,
            email: currentUser.email
        };

        if (newPassword) {
            updateData.newPassword = newPassword;
        }

        const res = await fetch('/updateProfile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: Server not responding`);
        }

        const data = await res.json();

        if (data.success) {
            // Update stored user info
            const updatedUser = { ...currentUser, name, phone };
            
            // Determine which storage was being used and update accordingly
            const wasRemembered = localStorage.getItem('currentUser') !== null;
            saveCurrentUser(updatedUser, wasRemembered);

            currentUser = updatedUser;
            
            // Update header
            if (window.headerManager) {
                headerManager.currentUser = updatedUser;
                headerManager.updateHeaderDisplay();
            }

            alert('Profile updated successfully!');
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
        } else {
            if (data.message.includes('password')) {
                showError('current-password-error', data.message);
            } else {
                alert(data.message || 'Update failed');
            }
        }
    } catch (err) {
        console.error('Profile update error:', err);
        if (err.message.includes('404') || err.message.includes('Server not responding')) {
            alert('Server not available. Please make sure the Express server is running locally on port 3000.');
        } else {
            alert('Server error. Please try again later.');
        }
    }
});