require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const config = require('./config');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static('docs'));

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs', 'volunteer.html'));
});

// --- Cloud MySQL config ---
const dbConfig = config.database;

let db;

async function connectDB() {
    try {
        db = await mysql.createConnection(dbConfig);
        console.log('Connected to MySQL database with SSL');
        
        // Test the connection
        await db.ping();
        console.log('Database connection test successful');
    } catch (error) {
        console.error('Failed to connect to database:', error.message);
        throw error;
    }

    // Create tables if not exist
    await db.query(`
        CREATE TABLE IF NOT EXISTS volunteers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100),
            email VARCHAR(100) UNIQUE,
            phone VARCHAR(20),
            password_hash VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS slots (
            id INT AUTO_INCREMENT PRIMARY KEY,
            slot VARCHAR(50) UNIQUE,
            booked_by VARCHAR(100)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS schedule_dates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            week_start_date DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Initialize slots if empty
    const [rows] = await db.query('SELECT COUNT(*) AS count FROM slots');
    if (rows[0].count === 0) {
        const days = ['Mon','Tue','Wed','Thurs','Fri','Sat','Sun'];
        const times = ['9am-12pm','1pm-3pm','4pm-6pm'];
        for (const day of days) {
            for (const time of times) {
                await db.query('INSERT INTO slots (slot, booked_by) VALUES (?,NULL)', [`${day}-${time}`]);
            }
        }
    }

    // Initialize schedule dates if empty (set current week)
    const [dateRows] = await db.query('SELECT COUNT(*) AS count FROM schedule_dates');
    if (dateRows[0].count === 0) {
        const today = new Date();
        const monday = new Date(today);
        monday.setDate(today.getDate() - today.getDay() + 1); // Get Monday of current week
        await db.query('INSERT INTO schedule_dates (week_start_date) VALUES (?)', [monday.toISOString().split('T')[0]]);
    }
}
 connectDB().catch(err => {                                                                                          
      console.error('Database connection failed:', err);                                                              
      console.error('Full error details:', err.message);                                                              
  });                                                                                                                 
                                

// --- Volunteer registration ---
app.post('/registerVolunteer', async (req,res)=>{
    try {
        const {name,email,phone,password} = req.body;
        if(!name || !email || !phone || !password) return res.json({success:false,message:'Missing fields'});
        
        // Password validation
        if(password.length < 6) {
            return res.json({success:false,message:'Password must be at least 6 characters long'});
        }
        
        // Check if database is connected
        if (!db) {
            console.error('Database not connected');
            return res.status(503).json({success:false,message:'Database connection unavailable'});
        }
        
        // Check if email already exists
        const [existing] = await db.query('SELECT * FROM volunteers WHERE email=?',[email]);
        if(existing.length > 0) {
            return res.json({success:false,message:'Email already registered'});
        }
        
        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);
        
        await db.query('INSERT INTO volunteers (name,email,phone,password_hash) VALUES (?,?,?,?)',[name,email,phone,password_hash]);
        res.json({success:true,message:'Registration successful'});
    } catch(err){
        console.error('Volunteer registration error:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ENOTFOUND') {
            res.status(503).json({success:false,message:'Database connection lost'});
        } else {
            res.status(500).json({success:false,message:'Database error'});
        }
    }
});

// --- Volunteer login ---
app.post('/login', async (req,res)=>{
    try {
        const {email,password} = req.body;
        if(!email || !password) return res.json({success:false,message:'Email and password are required'});
        
        // Check if database is connected
        if (!db) {
            console.error('Database not connected');
            return res.status(503).json({success:false,message:'Database connection unavailable'});
        }
        
        // Check if this is admin login
        if (email === config.app.admin.email) {
            console.log('email', email)
            console.log('adminemail', config.app.admin.email)
            if (password === config.app.admin.password) {
                return res.json({
                    success: true,
                    user: {
                        id: 'admin',
                        name: 'Administrator',
                        email: config.app.admin.email,
                        isAdmin: true
                    }
                });
            } else {
                return res.json({success:false,message:'Invalid email or password'});
            }
        }
        
        // Find regular user by email
        const [rows] = await db.query('SELECT * FROM volunteers WHERE email=?',[email]);
        if(rows.length === 0) {
            return res.json({success:false,message:'Invalid email or password'});
        }
        
        const user = rows[0];
        
        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if(!passwordMatch) {
            return res.json({success:false,message:'Invalid email or password'});
        }
        
        res.json({
            success:true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone
            }
        });
    } catch(err){
        console.error('Login error:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ENOTFOUND') {
            res.status(503).json({success:false,message:'Database connection lost'});
        } else {
            res.status(500).json({success:false,message:'Database error'});
        }
    }
});

// --- Get timetable ---
app.get('/timetable', async (req,res)=>{
    try{
        const [slots] = await db.query('SELECT slot, booked_by FROM slots');
        const [dates] = await db.query('SELECT week_start_date FROM schedule_dates ORDER BY created_at DESC LIMIT 1');
        
        res.json({
            slots: slots,
            weekStartDate: dates.length > 0 ? dates[0].week_start_date : null
        });
    }catch(err){
        console.error(err);
        res.json({slots: [], weekStartDate: null});
    }
});

// --- Book/release slot ---
app.post('/book', async (req,res)=>{
    try{
        const {email, name, slot} = req.body;
        if(!email || !slot) return res.json({success:false,message:'Missing fields'});

        const [rows] = await db.query('SELECT booked_by FROM slots WHERE slot=?',[slot]);
        if(rows.length===0) return res.json({success:false,message:'Slot not found'});

        const bookedBy = rows[0].booked_by;
        if(bookedBy && bookedBy!==email) return res.json({success:false,message:'Slot already booked by another user'});

        const newValue = bookedBy===email ? null : email;
        await db.query('UPDATE slots SET booked_by=? WHERE slot=?',[newValue,slot]);
        res.json({success:true});
    }catch(err){
        console.error(err);
        res.json({success:false,message:'Database error'});
    }
});


// --- Update user profile ---
app.post('/updateProfile', async (req,res)=>{
    try {
        const {email, name, phone, currentPassword, newPassword} = req.body;
        if(!email || !name || !phone || !currentPassword) {
            return res.json({success:false,message:'Missing required fields'});
        }
        
        // Get user from database
        const [rows] = await db.query('SELECT * FROM volunteers WHERE email=?',[email]);
        if(rows.length === 0) {
            return res.json({success:false,message:'User not found'});
        }
        
        const user = rows[0];
        
        // Verify current password
        const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if(!passwordMatch) {
            return res.json({success:false,message:'Current password is incorrect'});
        }
        
        // Update user data
        let updateQuery = 'UPDATE volunteers SET name=?, phone=?';
        let updateParams = [name, phone];
        
        // If new password provided, hash it and include in update
        if(newPassword) {
            const saltRounds = 10;
            const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
            updateQuery += ', password_hash=?';
            updateParams.push(newPasswordHash);
        }
        
        updateQuery += ' WHERE email=?';
        updateParams.push(email);
        
        await db.query(updateQuery, updateParams);
        
        res.json({success:true,message:'Profile updated successfully'});
    } catch(err){
        console.error('Profile update error:', err);
        res.status(500).json({success:false,message:'Database error'});
    }
});

// --- Admin reset timetable ---
app.post('/reset', async (req,res)=>{
    try{
        await db.query('UPDATE slots SET booked_by=NULL');
        res.json({success:true});
    }catch(err){
        console.error(err);
        res.json({success:false});
    }
});

// --- Admin set schedule dates and days ---
app.post('/setScheduleDates', async (req,res)=>{
    try{
        const { weekStartDate, activeDays, adminEmail } = req.body;
        
        // Verify admin permissions
        if (adminEmail !== config.app.admin.email) {
            return res.json({success:false,message:'Admin access required'});
        }
        
        if (!weekStartDate) {
            return res.json({success:false,message:'Week start date is required'});
        }
        
        if (!activeDays || !Array.isArray(activeDays) || activeDays.length === 0) {
            return res.json({success:false,message:'At least one active day is required'});
        }
        
        // Clear all existing slots
        await db.query('DELETE FROM slots');
        
        // Insert new slots only for selected days
        const times = ['9am-12pm','1pm-3pm','4pm-6pm'];
        for (const day of activeDays) {
            for (const time of times) {
                await db.query('INSERT INTO slots (slot, booked_by) VALUES (?,NULL)', [`${day}-${time}`]);
            }
        }
        
        // Insert new week start date
        await db.query('INSERT INTO schedule_dates (week_start_date) VALUES (?)', [weekStartDate]);
        res.json({success:true});
    }catch(err){
        console.error(err);
        res.json({success:false,message:'Database error'});
    }
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('SSL enabled for database connections');
});

// Set server timeout
server.timeout = 30000; // 30 seconds
server.keepAliveTimeout = 5000; // 5 seconds
server.headersTimeout = 10000; // 10 seconds
