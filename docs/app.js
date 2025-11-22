let currentUser = null;

// Check if user is logged in on page load
document.addEventListener('DOMContentLoaded', function() {
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
async function loadTimetable(){
    try {
        const res = await fetch('/timetable');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        console.log('Loaded data:', data);
        
        // Handle both old format (array) and new format (object)
        const slots = Array.isArray(data) ? data : data.slots;
        const weekStartDate = Array.isArray(data) ? null : data.weekStartDate;
        
        const grid = document.getElementById('schedule-grid');
        grid.innerHTML='';

        // Get available days from slots (only days that exist in database)
        const availableDays = [...new Set(slots.map(slot => slot.slot.split('-')[0]))];
        const dayNames = {
            'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 
            'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday'
        };
        const times = ['9am-12pm','1pm-3pm','4pm-6pm'];

        // Calculate dates for available days
        let weekDates = [];
        if (weekStartDate && availableDays.length > 0) {
            const startDate = new Date(weekStartDate);
            const dayIndices = {'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6};
            availableDays.forEach(dayAbb => {
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + dayIndices[dayAbb]);
                weekDates.push(currentDate);
            });
        }

        // Create header with dates
        if (weekStartDate && weekDates.length > 0) {
            const headerDiv = document.createElement('div');
            headerDiv.className = 'schedule-header';
            headerDiv.innerHTML = `<h4>Schedule for Week: ${formatWeekRange(weekDates[0], weekDates[weekDates.length-1])}</h4>`;
            grid.appendChild(headerDiv);
        }

        // Create table
        const table = document.createElement('table');
        table.className = 'schedule-table table-responsive';

        // Create header row
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = '<th>Time</th>';
        availableDays.forEach((dayAbb, index) => {
            const dateStr = weekDates.length > index ? formatDate(weekDates[index]) : '';
            headerRow.innerHTML += `<th>${dayNames[dayAbb]}<br><span class="date-small">${dateStr}</span></th>`;
        });
        table.appendChild(headerRow);

        // Create time slot rows
        times.forEach(time => {
            const row = document.createElement('tr');
            row.innerHTML = `<td><strong>${time}</strong></td>`;
            
            availableDays.forEach(dayAbb => {
                const slotObj = slots.find(s=>s.slot===`${dayAbb}-${time}`);
                const cell = document.createElement('td');
                cell.className='slot';
                cell.dataset.slot=`${dayAbb}-${time}`;

                if(slotObj && slotObj.booked_by != null){
                    if(slotObj.booked_by===currentUser.email){
                        cell.classList.add('mine');
                        cell.textContent='Mine (click to release)';
                        cell.addEventListener('click', ()=>toggleSlot(slotObj.slot));
                    }else{
                        cell.classList.add('booked');
                        cell.textContent='Booked';
                    }
                } else if(slotObj) {
                    cell.textContent='Available';
                    cell.addEventListener('click', ()=>toggleSlot(slotObj.slot));
                }
                row.appendChild(cell);
            });
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

// Book/release slot
async function toggleSlot(slotId){
    try {
        console.log('Booking slot:', slotId, 'for user:', currentUser.email);
        const res = await fetch('/book',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({email:currentUser.email, name:currentUser.name, slot:slotId})
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        if(!data.success) {
            alert(data.message||'Failed to book/release slot');
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
        const res = await fetch('/timetable');
        const data = await res.json();
        
        // Handle both old format (array) and new format (object)
        const slots = Array.isArray(data) ? data : data.slots;
        const weekStartDate = Array.isArray(data) ? null : data.weekStartDate;
        
        const bookedSlots = slots.filter(slot => slot.booked_by);
        const adminBookingsDiv = document.getElementById('admin-bookings');
        
        if (bookedSlots.length === 0) {
            adminBookingsDiv.innerHTML = '<p>No current bookings</p>';
        } else {
            adminBookingsDiv.innerHTML = `
                <h4>Current Bookings (${bookedSlots.length})</h4>
                <div class="bookings-list">
                    ${bookedSlots.map(slot => 
                        `<div class="booking-item">
                            <strong>${slot.slot}</strong> - ${slot.booked_by}
                        </div>`
                    ).join('')}
                </div>
            `;
        }
    } catch (err) {
        console.error('Failed to load bookings:', err);
        document.getElementById('admin-bookings').innerHTML = '<p style="color: red;">Failed to load bookings</p>';
    }
}

// Admin function to change schedule dates and days
async function changeScheduleDates() {
    if (!currentUser.isAdmin) return;
    
    // Create a modal-like interface for better UX
    const modalHtml = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; justify-content: center; align-items: center;">
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%;">
                <h4>Configure Schedule</h4>
                
                <div style="margin: 20px 0;">
                    <label><strong>Week Start Date (Monday):</strong></label><br>
                    <input type="date" id="weekStartInput" value="${getNextMonday().toISOString().split('T')[0]}" style="width: 100%; padding: 8px; margin: 5px 0;">
                </div>
                
                <div style="margin: 20px 0;">
                    <label><strong>Active Days:</strong></label><br>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0;">
                        <label><input type="checkbox" id="mon" value="Mon" checked> Monday</label>
                        <label><input type="checkbox" id="tue" value="Tue" checked> Tuesday</label>
                        <label><input type="checkbox" id="wed" value="Wed" checked> Wednesday</label>
                        <label><input type="checkbox" id="thu" value="Thu"> Thursday</label>
                        <label><input type="checkbox" id="fri" value="Fri"> Friday</label>
                        <label><input type="checkbox" id="sat" value="Sat"> Saturday</label>
                        <label><input type="checkbox" id="sun" value="Sun"> Sunday</label>
                    </div>
                    <small style="color: #666;">Select which days will have volunteer slots available</small>
                </div>
                
                <div style="margin: 20px 0; text-align: center;">
                    <button onclick="applyScheduleConfig()" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; margin: 5px;">Apply Changes</button>
                    <button onclick="closeScheduleModal()" style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 5px; margin: 5px;">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    const modalDiv = document.createElement('div');
    modalDiv.id = 'scheduleModal';
    modalDiv.innerHTML = modalHtml;
    document.body.appendChild(modalDiv);
}

async function applyScheduleConfig() {
    const weekStartInput = document.getElementById('weekStartInput');
    const newStartDate = weekStartInput.value;
    
    // Get selected days
    const dayCheckboxes = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const activeDays = dayCheckboxes
        .map(id => document.getElementById(id))
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    
    if (!newStartDate) {
        alert('Please select a start date');
        return;
    }
    
    if (activeDays.length === 0) {
        alert('Please select at least one day');
        return;
    }
    
    // Validate it's a Monday
    const testDate = new Date(newStartDate);
    if (testDate.getDay() !== 1) {
        alert('Please select a Monday date');
        return;
    }
    
    try {
        const res = await fetch('/setScheduleDates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                weekStartDate: newStartDate,
                activeDays: activeDays,
                adminEmail: currentUser.email
            })
        });
        
        const data = await res.json();
        
        if (data.success) {
            alert(`Schedule updated successfully!\nActive days: ${activeDays.join(', ')}`);
            closeScheduleModal();
            loadTimetable(); // Refresh the schedule
        } else {
            alert(`Failed to update schedule: ${data.message || 'Unknown error'}`);
        }
    } catch (err) {
        console.error('Failed to update schedule:', err);
        alert('Server error while updating schedule');
    }
}

function closeScheduleModal() {
    const modal = document.getElementById('scheduleModal');
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
