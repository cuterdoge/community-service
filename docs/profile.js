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
    loadMyVolunteerSlots();
    loadMyDonations();
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

// Load user's volunteer slots
async function loadMyVolunteerSlots() {
    try {
        const res = await fetch('/myBookings', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email: currentUser.email})
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        const slotsContainer = document.getElementById('my-volunteer-slots');
        
        if (!data.bookings || data.bookings.length === 0) {
            slotsContainer.innerHTML = '<p>You have no volunteer slots booked yet. <a href="volunteer.html">Book a slot now!</a></p>';
        } else {
            slotsContainer.innerHTML = `
                <div class="bookings-list">
                    ${data.bookings.map(booking => {
                        console.log('Booking slot:', booking.slot);
                        const slotParts = booking.slot.split('-');
                        const date = slotParts[0] + '-' + slotParts[1] + '-' + slotParts[2]; // YYYY-MM-DD
                        const time = slotParts[3]; // Morning/Afternoon/Night
                        
                        const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                        });
                        
                        const timeDisplay = time === 'Morning' ? 'Morning (9am-12pm)' : 
                                          time === 'Afternoon' ? 'Afternoon (1pm-5pm)' : 
                                          time === 'Night' ? 'Night (6pm-9pm)' : time;
                        
                        return `<div class="booking-item">
                            <div class="booking-date"><strong>${formattedDate}</strong></div>
                            <div class="booking-time">${timeDisplay}</div>
                            <div class="booking-actions">
                                <button onclick="cancelVolunteerSlot('${booking.slot}')" class="cancel-btn-small">Cancel</button>
                            </div>
                        </div>`
                    }).join('')}
                </div>
            `;
        }
    } catch (err) {
        console.error('Failed to load volunteer slots:', err);
        document.getElementById('my-volunteer-slots').innerHTML = '<p style="color: red;">Failed to load volunteer slots. Please try again.</p>';
    }
}

// Cancel a volunteer slot
async function cancelVolunteerSlot(slotId) {
    if (!confirm('Are you sure you want to cancel this volunteer slot?')) {
        return;
    }
    
    try {
        const res = await fetch('/book', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                email: currentUser.email,
                name: currentUser.name,
                slot: slotId
            })
        });
        
        const data = await res.json();
        if (data.success) {
            alert('Volunteer slot cancelled successfully!');
            loadMyVolunteerSlots(); // Refresh the list
        } else {
            alert(data.message || 'Failed to cancel slot');
        }
    } catch (err) {
        console.error('Cancel error:', err);
        alert('Server error. Please try again.');
    }
}

// Load user's donation history
async function loadMyDonations() {
    try {
        const donationsContainer = document.getElementById('my-donations');
        donationsContainer.innerHTML = '<p>Loading your donation history...</p>';
        
        // Get donations from database
        const response = await fetch('/getUserDonations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: currentUser.email
            })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Failed to load donations');
        }
        
        const donationHistory = result.donations || [];
        
        if (donationHistory.length === 0) {
            donationsContainer.innerHTML = `
                <div class="no-donations">
                    <p>🎯 You haven't made any donations yet.</p>
                    <p>Start making a difference in our community today!</p>
                    <a href="donations.html" class="donate-now-btn">Make Your First Donation</a>
                </div>
            `;
            return;
        }
        
        // Calculate donation stats
        const totalAmount = donationHistory.reduce((sum, donation) => sum + parseFloat(donation.total_amount), 0);
        const totalDonations = donationHistory.length;
        const totalItems = donationHistory.reduce((sum, donation) => 
            sum + donation.items.reduce((itemSum, item) => itemSum + parseInt(item.quantity), 0), 0);
        
        // Render donations with stats
        donationsContainer.innerHTML = `
            <div class="donation-stats">
                <div class="stat-item">
                    
                    <span class="stat-label">Donations Made</span>
                    <span class="stat-number">${totalDonations}</span>
                </div>
                <div class="stat-item">
                   
                    <span class="stat-label">Total Donated</span>
                     <span class="stat-number">RM ${totalAmount.toFixed(2)}</span>
                </div>
                <div class="stat-item">
                    
                    <span class="stat-label">Items Donated</span>
                    <span class="stat-number">${totalItems}</span>
                </div>
            </div>
            
            <div class="donations-list">
                ${donationHistory.map(donation => renderDonationItem(donation)).join('')}
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading donations:', error);
        document.getElementById('my-donations').innerHTML = 
            '<p style="color: red;">Failed to load donation history. Please try again.</p>';
    }
}

// Render individual donation item
function renderDonationItem(donation) {
    const donationDate = new Date(donation.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const impactSummary = donation.items.length > 1 
        ? `${donation.items.length} different items donated`
        : donation.items[0].impact;
    
    return `
        <div class="donation-item">
            <div class="donation-info">
                <div class="donation-title">Donation #${donation.transaction_id}</div>
                <div class="donation-date"> ${donationDate}</div>
                <div class="donation-impact"> ${impactSummary}</div>
            </div>
            <div class="donation-amount">RM ${parseFloat(donation.total_amount).toFixed(2)}</div>
            <div class="donation-actions">
                <button onclick="viewDonationReceipt('${donation.transaction_id}')" class="receipt-btn">
                    View Receipt
                </button>
            </div>
        </div>
    `;
}

// View donation receipt
async function viewDonationReceipt(transactionId) {
    try {
        // Get donations from database to find the specific one
        const response = await fetch('/getUserDonations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: currentUser.email
            })
        });
        
        const result = await response.json();
        
        if (!result.success) {
            alert('Failed to load donation data');
            return;
        }
        
        const donation = result.donations.find(d => d.transaction_id === transactionId);
        
        if (!donation) {
            alert('Receipt not found');
            return;
        }
        
        // Create receipt content
        const receiptContent = generateReceiptHTML(donation);
        
        // Open in new window
        const receiptWindow = window.open('', '_blank', 'width=600,height=800');
        receiptWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Donation Receipt - ${transactionId}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
                    .receipt-header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                    .receipt-section { margin-bottom: 25px; }
                    .receipt-section h3 { color: #333; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                    .item-row { display: flex; justify-content: space-between; padding: 5px 0; }
                    .total-row { font-weight: bold; border-top: 2px solid #333; padding-top: 10px; margin-top: 15px; }
                    .impact-section { background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
                    .thank-you { text-align: center; color: #667eea; font-style: italic; margin-top: 30px; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>
                ${receiptContent}
                <div style="text-align: center; margin-top: 30px;">
                    <button onclick="window.print()" style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Print Receipt</button>
                </div>
            </body>
            </html>
        `);
        receiptWindow.document.close();
        
    } catch (error) {
        console.error('Error viewing receipt:', error);
        alert('Error loading receipt. Please try again.');
    }
}

// Generate receipt HTML
function generateReceiptHTML(donation) {
    const donationDate = new Date(donation.created_at).toLocaleString();
    
    return `
        <div class="receipt-header">
            <h1>🏠 Joy Home Connect</h1>
            <h2>Donation Receipt</h2>
            <p>Thank you for making a difference!</p>
        </div>
        
        <div class="receipt-section">
            <h3>📋 Transaction Details</h3>
            <p><strong>Transaction ID:</strong> ${donation.transaction_id}</p>
            <p><strong>Date:</strong> ${donationDate}</p>
            <p><strong>Donor:</strong> ${currentUser.name}</p>
            <p><strong>Email:</strong> ${currentUser.email}</p>
        </div>
        
        <div class="receipt-section">
            <h3>🎁 Donation Items</h3>
            ${donation.items.map(item => `
                <div class="item-row">
                    <span>${item.name} (${item.quantity}x)</span>
                    <span>RM ${(item.quantity * item.price).toFixed(2)}</span>
                </div>
            `).join('')}
            <div class="item-row total-row">
                <span><strong>Total Donation</strong></span>
                <span><strong>RM ${parseFloat(donation.total_amount).toFixed(2)}</strong></span>
            </div>
        </div>
        
        <div class="impact-section">
            <h3>💫 Your Impact</h3>
            ${donation.items.map(item => `
                <p>• ${item.impact} (${item.quantity}x)</p>
            `).join('')}
        </div>
        
        <div class="thank-you">
            <h3>🙏 Thank You!</h3>
            <p>Your generous contribution will make a real difference in our community.<br>
            Together, we're building stronger communities!</p>
        </div>
    `;
}