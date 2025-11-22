let isAdmin=false;

document.getElementById('admin-login-form').addEventListener('submit', async e=>{
    e.preventDefault();
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value.trim();
    if(!username || !password) return alert('Fill all fields');

    try {
        const res = await fetch('http://localhost:3000/adminLogin',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({username,password})
        });
        const data = await res.json();

        if(data.success){
            isAdmin=true;
            document.getElementById('admin-login-form').style.display='none';
            document.getElementById('admin-dashboard').style.display='block';
            loadAllSlots();
        } else {
            alert(data.message || 'Invalid credentials');
        }
    } catch(err){
        console.error(err);
        alert('Server error. Check console.');
    }
});

// Load all slots
async function loadAllSlots(){
    const res = await fetch('http://localhost:3000/timetable');
    const slots = await res.json();
    const grid = document.getElementById('all-slots-grid');
    grid.innerHTML='';
    slots.forEach(s=>{
        const div = document.createElement('div');
        div.className='slot';
        div.textContent=`${s.slot}: ${s.booked_by || 'Available'}`;
        grid.appendChild(div);
    });
}

// Reset timetable
document.getElementById('reset-button').addEventListener('click', async ()=>{
    if(!isAdmin) return;
    const res = await fetch('http://localhost:3000/reset',{method:'POST'});
    const data = await res.json();
    if(!data.success) return alert('Failed');
    loadAllSlots();
});
