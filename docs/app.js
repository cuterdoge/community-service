let currentUser = null;

// Check if user is logged in on page load
document.addEventListener('DOMContentLoaded', function () {
    checkUserAuth();
});

function checkUserAuth() {
    currentUser = getCurrentUser();

    if (currentUser) {
        console.log('User found:', currentUser);
        showDashboard();
    } else {
        console.log('No user found, showing login prompt');
        showLoginPrompt();
    }
}

function showLoginPrompt() {
    document.getElementById('login-prompt').style.display = 'block';
    document.getElementById('volunteer-dashboard').style.display = 'none';
}

function showDashboard() {
    document.getElementById('login-prompt').style.display = 'none';
    document.getElementById('volunteer-dashboard').style.display = 'block';

    if (currentUser.isAdmin) {
        document.getElementById('welcome-message').textContent = `Welcome, ${currentUser.name}`;
        document.getElementById('admin-section').style.display = 'block';
        // Change page title for admin
        document.querySelector('h2').textContent = 'Admin Dashboard';
    } else {
        document.getElementById('welcome-message').textContent = `Welcome, ${currentUser.name}`;
        document.getElementById('admin-section').style.display = 'none';
    }

    loadTimetable();
}

// logout function is now in auth.js

// Load timetable
async function loadTimetable() {
    try {
        const dateInput = document.getElementById('volunteerDate');
        const selectedDate = dateInput ? new Date(dateInput.value) : new Date();

        const grid = document.getElementById('schedule-grid');
        grid.innerHTML = '';

        const times = ['Morning (9am-12pm)', 'Afternoon (1pm-5pm)', 'Night (6pm-9pm)'];
        const timeKeys = ['Morning', 'Afternoon', 'Night'];

        // Create header for selected date
        const headerDiv = document.createElement('div');
        headerDiv.className = 'schedule-header';
        const dateStr = selectedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        headerDiv.innerHTML = DOMPurify.sanitize(`<h4>Available Time Slots for ${dateStr}</h4>`);
        grid.appendChild(headerDiv);

        // Create table for the selected date
        const table = document.createElement('table');
        table.className = 'schedule-table table-responsive';

        // Create header row
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th>Time Period</th><th>Status</th><th>Action</th>';
        table.appendChild(headerRow);

        // Create time slot rows for the selected date
        times.forEach((time, index) => {
            const row = document.createElement('tr');

            // Time period column
            const timeCell = document.createElement('td');
            timeCell.innerHTML = `<strong>${time}</strong>`;
            row.appendChild(timeCell);

            // Status column
            const statusCell = document.createElement('td');
            statusCell.className = 'slot';

            // Action column
            const actionCell = document.createElement('td');

            // Create slot identifier based on date and time
            const slotId = `${selectedDate.toISOString().split('T')[0]}-${timeKeys[index]}`;

            // For now, show as available (this would connect to your backend)
            statusCell.innerHTML = '<span style="color: green;">Available</span>';
            actionCell.innerHTML = DOMPurify.sanitize(`<button class="btn btn-primary btn-sm" onclick="bookSlot('${slotId}')">Book Slot</button>`);

            row.appendChild(statusCell);
            row.appendChild(actionCell);
            table.appendChild(row);
        });

        grid.appendChild(table);

    } catch (err) {
        console.error('Failed to load timetable:', err);
        const grid = document.getElementById('schedule-grid');
        grid.innerHTML = '<p style="color: red; text-align: center; margin: 20px;">❌ Server not available. Please start the Express server locally.</p>';
    }
}

// Helper functions for date formatting
function formatDate(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekRange(startDate, endDate) {
    const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startStr} - ${endStr}`;
}

// Book slot for selected date and time
async function bookSlot(slotId) {
    try {
        console.log('Booking slot:', slotId, 'for user:', currentUser.email);
        const res = await fetch('/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: currentUser.email,
                name: currentUser.name,
                slot: slotId
            })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (!data.success) {
            alert(data.message || 'Failed to book slot');
        } else {
            alert('Slot booked successfully!');
            console.log('Slot booking successful');
        }
        loadTimetable(); // Refresh the display
    } catch (err) {
        console.error('Failed to book slot:', err);
        alert('Server error. Please try again.');
    }
}

// Book/release slot
async function toggleSlot(slotId) {
    try {
        console.log('Booking slot:', slotId, 'for user:', currentUser.email);
        const res = await fetch('/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: currentUser.email, name: currentUser.name, slot: slotId })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (!data.success) {
            alert(data.message || 'Failed to book/release slot');
        } else {
            console.log('Slot booking successful');
        }
        loadTimetable();
    } catch (err) {
        console.error('Failed to toggle slot:', err);
        alert('Server error. Please try again.');
    }
}

// Admin functions
async function resetAllSlots() {
    if (!currentUser.isAdmin) return;

    if (!confirm('Are you sure you want to reset ALL bookings? This cannot be undone.')) {
        return;
    }

    try {
        const res = await fetch('/reset', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            alert('All bookings have been reset successfully!');
            loadTimetable();
        } else {
            alert('Failed to reset bookings');
        }
    } catch (err) {
        console.error('Reset error:', err);
        alert('Server error');
    }
}

async function viewAllBookings() {
    if (!currentUser.isAdmin) return;

    try {
        const res = await fetch('/allBookings');
        const data = await res.json();

        const adminBookingsDiv = document.getElementById('admin-bookings');

        if (!data.bookings || data.bookings.length === 0) {
            adminBookingsDiv.innerHTML = '<p>No current bookings</p>';
        } else {
            adminBookingsDiv.innerHTML = DOMPurify.sanitize(`
                <h4>Current Bookings (${data.bookings.length})</h4>
                <div class="bookings-list">
                    ${data.bookings.map(booking => {
                console.log('Admin view booking slot:', booking.slot);
                const slotParts = booking.slot.split('-');
                const date = slotParts[0] + '-' + slotParts[1] + '-' + slotParts[2]; // YYYY-MM-DD
                const time = slotParts[3]; // Morning/Afternoon/Night

                const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });

                const timeDisplay = time === 'Morning' ? 'Morning (9am-12pm)' :
                    time === 'Afternoon' ? 'Afternoon (1pm-5pm)' :
                        time === 'Night' ? 'Night (6pm-9pm)' : time;

                return `<div class="booking-item">
                            <strong>${formattedDate}</strong> - ${timeDisplay} 
                            <br><small>Volunteer: ${booking.booked_by} (${booking.name || 'N/A'})</small>
                        </div>`
            }).join('')}
                </div>
            `);
        }
    } catch (err) {
        console.error('Failed to load bookings:', err);
        document.getElementById('admin-bookings').innerHTML = '<p style="color: red;">Failed to load bookings</p>';
    }
}

// Admin function to manage unavailable dates
async function manageUnavailableDates() {
    if (!currentUser.isAdmin) return;

    // Get current unavailable dates
    let unavailableDates = [];
    try {
        const res = await fetch('/getUnavailableDates');
        const data = await res.json();
        unavailableDates = data.dates || [];
    } catch (err) {
        console.error('Failed to load unavailable dates:', err);
    }

    // Create a modal-like interface for better UX
    const modalHtml = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; justify-content: center; align-items: center;">
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <h4>Manage Unavailable Dates</h4>
                <p>Block dates when volunteering is not available (holidays, maintenance, etc.)</p>
                
                <div style="margin: 20px 0;">
                    <label><strong>Add Unavailable Date:</strong></label><br>
                    <input type="date" id="unavailableDateInput" style="width: 100%; padding: 8px; margin: 5px 0;">
                    <button onclick="addUnavailableDate()" style="background: #dc3545; color: white; padding: 8px 15px; border: none; border-radius: 3px; margin: 5px 0;">Block Date</button>
                </div>
                
                <div style="margin: 20px 0;">
                    <label><strong>Currently Blocked Dates:</strong></label><br>
                    <div id="unavailableDatesList" style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 10px; margin: 10px 0;">
                        ${unavailableDates.length === 0 ? '<p>No dates are currently blocked</p>' :
            unavailableDates.map(date => `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid #eee;">
                                <span>${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                <button onclick="removeUnavailableDate('${date}')" style="background: #28a745; color: white; padding: 2px 8px; border: none; border-radius: 3px; font-size: 12px;">Unblock</button>
                            </div>
                          `).join('')}
                    </div>
                </div>
                
                <div style="margin: 20px 0; text-align: center;">
                    <button onclick="closeUnavailableModal()" style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 5px; margin: 5px;">Close</button>
                </div>
            </div>
        </div>
    `;

    // Add modal to page
    const modalDiv = document.createElement('div');
    modalDiv.id = 'unavailableModal';
    modalDiv.innerHTML = DOMPurify.sanitize(modalHtml);
    document.body.appendChild(modalDiv);
}

async function addUnavailableDate() {
    const dateInput = document.getElementById('unavailableDateInput');
    const date = dateInput.value;

    if (!date) {
        alert('Please select a date');
        return;
    }

    try {
        const res = await apiFetch('/setUnavailableDate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: date
            })
        });

        const data = await res.json();

        if (data.success) {
            alert('Date blocked successfully!');
            dateInput.value = '';
            closeUnavailableModal();
            manageUnavailableDates(); // Refresh the modal
        } else {
            alert(`Failed to block date: ${data.message || 'Unknown error'}`);
        }
    } catch (err) {
        console.error('Failed to block date:', err);
        alert('Server error while blocking date');
    }
}

async function removeUnavailableDate(date) {
    try {
        const res = await apiFetch('/removeUnavailableDate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: date
            })
        });

        const data = await res.json();

        if (data.success) {
            alert('Date unblocked successfully!');
            closeUnavailableModal();
            manageUnavailableDates(); // Refresh the modal
        } else {
            alert(`Failed to unblock date: ${data.message || 'Unknown error'}`);
        }
    } catch (err) {
        console.error('Failed to unblock date:', err);
        alert('Server error while unblocking date');
    }
}

function closeUnavailableModal() {
    const modal = document.getElementById('unavailableModal');
    if (modal) {
        modal.remove();
    }
}

// Helper function to get next Monday
function getNextMonday() {
    const today = new Date();
    const daysUntilMonday = (8 - today.getDay()) % 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + (daysUntilMonday === 0 ? 7 : daysUntilMonday));
    return nextMonday;
}
