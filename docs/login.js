// Input validation functions
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password.length >= 6;
}

function showError(elementId, message) {
    document.getElementById(elementId).textContent = message;
}

function clearErrors() {
    document.getElementById('email-error').textContent = '';
    document.getElementById('password-error').textContent = '';
}

// Login form handler
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    // Client-side validation
    let hasErrors = false;

    if (!email) {
        showError('email-error', 'Email is required');
        hasErrors = true;
    } else if (!validateEmail(email)) {
        showError('email-error', 'Please enter a valid email address');
        hasErrors = true;
    }

    if (!password) {
        showError('password-error', 'Password is required');
        hasErrors = true;
    } else if (!validatePassword(password)) {
        showError('password-error', 'Password must be at least 6 characters long');
        hasErrors = true;
    }

    if (hasErrors) return;

    try {
        const res = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: Server not responding. Running locally?`);
        }

        const data = await res.json();

        if (data.success) {
            const userInfo = {
                email: data.user.email,
                name: data.user.name,
                id: data.user.id,
                isAdmin: data.user.isAdmin || false
            };
            
            // Transfer profile picture from temp storage if exists
            const tempPicKey = `temp_profile_pic_${email}`;
            const tempPic = localStorage.getItem(tempPicKey);
            if (tempPic) {
                localStorage.setItem(`profile_pic_${data.user.id}`, tempPic);
                localStorage.removeItem(tempPicKey);
            }
            
            // Store user info based on "Remember Me" choice
            const rememberMe = document.getElementById('remember-me').checked;
            saveCurrentUser(userInfo, rememberMe);
            
            console.log('Login successful, redirecting to volunteer page');
            window.location.href = 'volunteer.html';
        } else {
            alert(data.message || 'Login failed. Please check your email and name.');
        }
    } catch (err) {
        console.error('Login error:', err);
        if (err.message.includes('404') || err.message.includes('Server not responding')) {
            alert('Server not available. Please make sure the Express server is running locally on port 3000.');
        } else {
            alert('Server error. Please try again later.');
        }
    }
});