require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

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
const dbConfig = {
    host: process.env.DB_HOST,      // from cloud database
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    ssl: {
        rejectUnauthorized: false   // Required for Railway MySQL
    },
    connectTimeout: 30000,          // 30 seconds
    acquireTimeout: 30000,          // 30 seconds
    timeout: 30000,                 // 30 seconds
    reconnect: true,
    maxReconnects: 3
};

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
            email VARCHAR(100),
            phone VARCHAR(20)
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS slots (
            id INT AUTO_INCREMENT PRIMARY KEY,
            slot VARCHAR(50) UNIQUE,
            booked_by VARCHAR(100)
        )
    `);

    // Initialize slots if empty
    const [rows] = await db.query('SELECT COUNT(*) AS count FROM slots');
    if (rows[0].count === 0) {
        const days = ['Mon','Tue','Wed'];
        const times = ['9am-12pm','1pm-3pm','4pm-6pm'];
        for (const day of days) {
            for (const time of times) {
                await db.query('INSERT INTO slots (slot, booked_by) VALUES (?,NULL)', [`${day}-${time}`]);
            }
        }
    }
}
 connectDB().catch(err => {                                                                                          
      console.error('Database connection failed:', err);                                                              
      console.error('Full error details:', err.message);                                                              
  });                                                                                                                 
                                

// --- Volunteer registration ---
app.post('/registerVolunteer', async (req,res)=>{
    try {
        const {name,email,phone} = req.body;
        if(!name || !email || !phone) return res.json({success:false,message:'Missing fields'});
        
        // Check if database is connected
        if (!db) {
            console.error('Database not connected');
            return res.status(503).json({success:false,message:'Database connection unavailable'});
        }
        
        await db.query('INSERT INTO volunteers (name,email,phone) VALUES (?,?,?)',[name,email,phone]);
        res.json({success:true,name});
    } catch(err){
        console.error('Volunteer registration error:', err);
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
        const [rows] = await db.query('SELECT slot, booked_by FROM slots');
        res.json(rows);
    }catch(err){
        console.error(err);
        res.json([]);
    }
});

// --- Book/release slot ---
app.post('/book', async (req,res)=>{
    try{
        const {name, slot} = req.body;
        if(!name || !slot) return res.json({success:false,message:'Missing fields'});

        const [rows] = await db.query('SELECT booked_by FROM slots WHERE slot=?',[slot]);
        if(rows.length===0) return res.json({success:false,message:'Slot not found'});

        const bookedBy = rows[0].booked_by;
        if(bookedBy && bookedBy!==name) return res.json({success:false,message:`Slot already booked by ${bookedBy}`});

        const newValue = bookedBy===name ? null : name;
        await db.query('UPDATE slots SET booked_by=? WHERE slot=?',[newValue,slot]);
        res.json({success:true});
    }catch(err){
        console.error(err);
        res.json({success:false,message:'Database error'});
    }
});

// --- Admin login ---
app.post('/adminLogin', async (req,res)=>{
    const {username,password} = req.body;
    if(username==='admin' && password==='admin123') res.json({success:true});
    else res.json({success:false,message:'Invalid credentials'});
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
