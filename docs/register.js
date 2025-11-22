// Input validation functions
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validateName(name) {
    return name.trim().length >= 2 && /^[a-zA-Z\s]+$/.test(name.trim());
}

function validatePhone(phone) {
    // Accept various phone formats: 012-3456789, 012 3456789, 0123456789, +60123456789
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
    document.getElementById('email-error').textContent = '';
    document.getElementById('phone-error').textContent = '';
    document.getElementById('password-error').textContent = '';
    document.getElementById('confirm-password-error').textContent = '';
    document.getElementById('profile-pic-error').textContent = '';
}

// Profile picture preview
document.getElementById('reg-profile-pic').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('profile-preview');
    const previewImg = document.getElementById('preview-img');
    const errorSpan = document.getElementById('profile-pic-error');
    
    if (file) {
        // Validate file
        if (!file.type.match('image/jpeg') && !file.type.match('image/png')) {
            showError('profile-pic-error', 'Please select a JPG or PNG image');
            preview.style.display = 'none';
            return;
        }
        
        if (file.size > 1024 * 1024) { // 1MB
            showError('profile-pic-error', 'Image must be under 1MB');
            preview.style.display = 'none';
            return;
        }
        
        // Show preview
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
        errorSpan.textContent = '';
    } else {
        preview.style.display = 'none';
    }
});

// Registration form handler
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;
    const profilePicFile = document.getElementById('reg-profile-pic').files[0];

    // Client-side validation
    let hasErrors = false;

    if (!name) {
        showError('name-error', 'Full name is required');
        hasErrors = true;
    } else if (!validateName(name)) {
        showError('name-error', 'Please enter a valid name (letters and spaces only, minimum 2 characters)');
        hasErrors = true;
    }

    if (!email) {
        showError('email-error', 'Email is required');
        hasErrors = true;
    } else if (!validateEmail(email)) {
        showError('email-error', 'Please enter a valid email address');
        hasErrors = true;
    }

    if (!phone) {
        showError('phone-error', 'Phone number is required');
        hasErrors = true;
    } else if (!validatePhone(phone)) {
        showError('phone-error', 'Please enter a valid phone number');
        hasErrors = true;
    }

    if (!password) {
        showError('password-error', 'Password is required');
        hasErrors = true;
    } else if (!validatePassword(password)) {
        showError('password-error', 'Password must be at least 6 characters long');
        hasErrors = true;
    }

    if (!confirmPassword) {
        showError('confirm-password-error', 'Please confirm your password');
        hasErrors = true;
    } else if (password !== confirmPassword) {
        showError('confirm-password-error', 'Passwords do not match');
        hasErrors = true;
    }

    if (hasErrors) return;

    try {
        const res = await fetch('/registerVolunteer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password })
        });

        const data = await res.json();

        if (data.success) {
            // Save profile picture locally if uploaded
            if (profilePicFile) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    // We'll save it with a temporary key, then update it after login
                    localStorage.setItem(`temp_profile_pic_${email}`, e.target.result);
                };
                reader.readAsDataURL(profilePicFile);
            }
            
            alert('Registration successful! You can now login.');
            window.location.href = 'login.html';
        } else {
            if (data.message.includes('email')) {
                showError('email-error', data.message);
            } else {
                alert(data.message || 'Registration failed');
            }
        }
    } catch (err) {
        console.error('Registration error:', err);
        if (err.message.includes('404') || err.message.includes('Failed to fetch')) {
            alert('Server not available. Please make sure the Express server is running locally on port 3000.');
        } else {
            alert('Server error. Please try again later.');
        }
    }
});