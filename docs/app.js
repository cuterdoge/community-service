let currentUser = null;

// Registration
document.getElementById('registration-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('vol-name').value.trim();
    const email = document.getElementById('vol-email').value.trim();
    const phone = document.getElementById('vol-phone').value.trim();
    if(!name || !email || !phone) return alert('Fill all fields');

    try {
        const res = await fetch('http://localhost:3000/registerVolunteer',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({name,email,phone})
        });
        const data = await res.json();

        if(data.success){
            currentUser = data.name;
            document.getElementById('registration-form-section').style.display='none';
            document.getElementById('timetable-section').style.display='block';
            loadTimetable();
        } else {
            alert(data.message || 'Registration failed');
        }
    } catch(err){
        console.error(err);
        alert('Server error. Check console.');
    }
});

// Load timetable
async function loadTimetable(){
    const res = await fetch('http://localhost:3000/timetable');
    const slots = await res.json();
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
            else if(slotObj.status==='booked'){
                if(slotObj.booked_by===currentUser){
                    div.classList.add('mine');
                    div.textContent='Mine (click to release)';
                    div.addEventListener('click', ()=>toggleSlot(slotObj.slot));
                }else{
                    div.classList.add('booked');
                    div.textContent=slotObj.booked_by;
                }
            } else {
                div.textContent='Available';
                div.addEventListener('click', ()=>toggleSlot(slotObj.slot));
            }
            grid.appendChild(div);
        });
        grid.appendChild(document.createElement('br'));
    });
}

// Book/release slot
async function toggleSlot(slotId){
    const res = await fetch('http://localhost:3000/book',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({name:currentUser, slot:slotId})
    });
    const data = await res.json();
    if(!data.success) alert(data.message||'Failed');
    loadTimetable();
}
