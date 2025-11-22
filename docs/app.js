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
        const slots = await res.json();
        console.log('Loaded slots:', slots);
        
        const grid = document.getElementById('schedule-grid');
        grid.innerHTML='';

        const days = ['Mon','Tue','Wed'];
        const times = ['9am-12pm','1pm-3pm','4pm-6pm'];

        times.forEach(time=>{
            days.forEach(day=>{
                const slotObj = slots.find(s=>s.slot===`${day}-${time}`);
                const div = document.createElement('div');
                div.className='slot';
                div.dataset.slot=`${day}-${time}`;

                if(!slotObj) div.textContent='N/A';
                else if(slotObj.booked_by != null){
                    if(slotObj.booked_by===currentUser.email){
                        div.classList.add('mine');
                        div.textContent='Mine (click to release)';
                        div.addEventListener('click', ()=>toggleSlot(slotObj.slot));
                    }else{
                        div.classList.add('booked');
                        div.textContent='Booked';
                    }
                } else {
                    div.textContent='Available';
                    div.addEventListener('click', ()=>toggleSlot(slotObj.slot));
                }
                grid.appendChild(div);
            });
            grid.appendChild(document.createElement('br'));
        });
    } catch (err) {
        console.error('Failed to load timetable:', err);
        const grid = document.getElementById('schedule-grid');
        grid.innerHTML = '<p style="color: red; text-align: center; margin: 20px;">❌ Server not available. Please start the Express server locally.</p>';
    }
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
        const slots = await res.json();
        
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
