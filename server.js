require('dotenv').config({ override: true });
const express = require('express');
const helmet = require('helmet');
const mysql = require('mysql2/promise');
const cors = require('cors');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const path = require('path');
const bcrypt = require('bcrypt');
const { body, param, query, validationResult } = require('express-validator');
const config = require('./config');
const rateLimit = require('express-rate-limit');

const app = express();

// Trust proxy for secure cookies behind Render/Railway
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Helmet security headers and CSP (Phase 3)
app.use(helmet({
    // Disable HSTS for now; can enable later via ENABLE_HSTS=true in env
    hsts: process.env.ENABLE_HSTS === 'true' ? { maxAge: 15552000, includeSubDomains: true } : false,
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", 'data:', "https://images.unsplash.com"],
            connectSrc: ["'self'"]
        }
    }
}));

// CORS with credentials support (Phase 4)
const isProd = process.env.NODE_ENV === 'production';
const allowedOrigins = isProd
    ? ['https://community-service-ahp0.onrender.com']
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (same-origin, curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    optionsSuccessStatus: 204
}));

// Rate Limiters (Phase 7)
// Global limiter: 1000 requests per 15 minutes
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 1000,
    standardHeaders: true,
    legacyHeaders: false
});
app.use(globalLimiter);

// Login limiter: 20 attempts per minute
const loginLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    limit: 20,
    message: { success: false, message: 'Too many login attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

app.use(express.json({ limit: '10mb' })); // Increased limit for image uploads

// Centralized validation error handler (Phase 5)
function withValidation(rules) {
    return [
        ...rules,
        (req, res, next) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    errors: errors.array().map(e => ({ field: e.path, msg: e.msg }))
                });
            }
            next();
        }
    ];
}

// Serve static files
app.use(express.static('docs'));

// Sessions
const sessionSecret = process.env.SESSION_SECRET || 'change_me_session_secret';
let sessionStore = undefined;

if (process.env.NODE_ENV === 'production') {
    // Use MySQL-based session store in production
    const dbConf = config.database;
    sessionStore = new MySQLStore({
        host: dbConf.host,
        port: dbConf.port,
        user: dbConf.user,
        password: dbConf.password,
        database: dbConf.database,
        createDatabaseTable: true
    });
}

app.use(session({
    name: 'sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));

// Default route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'docs', 'volunteer.html'));
});

// --- Cloud MySQL config ---
const dbConfig = config.database;

let db;

async function connectDB() {
    const maxRetries = 3;
    const retryDelay = 3000; // 3 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Database connection attempt ${attempt}/${maxRetries}...`);
            db = await mysql.createConnection(dbConfig);
            console.log('Connected to MySQL database with SSL');

            // Test the connection
            await db.ping();
            console.log('Database connection test successful');

            // Keep connection alive with periodic pings
            /*
            setInterval(async () => {
                try {
                    await db.ping();
                    console.log('Database keepalive ping successful');
                } catch (error) {
                    console.error('Database keepalive failed:', error.message);
                    // Attempt to reconnect
                    try {
                        await connectDB();
                    } catch (reconnectError) {
                        console.error('Reconnection failed:', reconnectError.message);
                    }
                }
            }, 30000); // Ping every 30 seconds
            */

            // Create tables if connected successfully
            try {
                await createTables();
                console.log('Database tables initialized successfully');
            } catch (tableError) {
                console.error('Table creation failed:', tableError.message);
                // Don't fail the connection for table creation issues
            }
            return; // Success, exit the retry loop
        } catch (error) {
            console.error(`Database connection attempt ${attempt} failed:`, error.message);

            if (attempt === maxRetries) {
                console.error('All database connection attempts failed. Server will continue but database features will be unavailable.');
                // Don't throw error, let server start without database
                return;
            }

            console.log(`Retrying in ${retryDelay / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
}

async function createTables() {
    if (!db) {
        console.log('Database not connected, skipping table creation');
        return;
    }

    // Create tables if not exist
    await db.query(`
        CREATE TABLE IF NOT EXISTS volunteers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100),
            email VARCHAR(100) UNIQUE,
            phone VARCHAR(20),
            password_hash VARCHAR(255),
            is_admin TINYINT(1) NOT NULL DEFAULT 0,
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

    await db.query(`
        CREATE TABLE IF NOT EXISTS unavailable_dates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            date DATE UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Create donation-related tables
    await db.query(`
        CREATE TABLE IF NOT EXISTS donation_packages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            package_id VARCHAR(50) UNIQUE,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            price DECIMAL(10,2) NOT NULL,
            impact_description TEXT,
            icon VARCHAR(10),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS donations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            transaction_id VARCHAR(50) UNIQUE,
            donor_id INT,
            donor_email VARCHAR(100),
            donor_name VARCHAR(100),
            total_amount DECIMAL(10,2) NOT NULL,
            status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
            payment_method JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP NULL,
            FOREIGN KEY (donor_id) REFERENCES volunteers(id) ON DELETE SET NULL
        )
    `);

    await db.query(`
        CREATE TABLE IF NOT EXISTS donation_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            donation_id INT,
            package_id VARCHAR(50),
            package_name VARCHAR(100),
            price DECIMAL(10,2),
            quantity INT,
            subtotal DECIMAL(10,2),
            impact_description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE CASCADE
        )
    `);

    // Initialize slots if empty
    const [rows] = await db.query('SELECT COUNT(*) AS count FROM slots');
    if (rows[0].count === 0) {
        const days = ['Mon', 'Tue', 'Wed', 'Thurs', 'Fri', 'Sat', 'Sun'];
        const times = ['9am-12pm', '1pm-3pm', '4pm-6pm'];
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

    // Create events table
    await db.query(`
        CREATE TABLE IF NOT EXISTS events (
            id VARCHAR(50) PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            date DATETIME NOT NULL,
            location VARCHAR(200),
            poster LONGTEXT,
            published BOOLEAN DEFAULT TRUE,
            created_by VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            modified_by VARCHAR(50)
        )
    `);

    // Initialize donation packages if empty
    const [packageRows] = await db.query('SELECT COUNT(*) AS count FROM donation_packages');
    if (packageRows[0].count === 0) {
        const donationPackages = [
            {
                package_id: 'water-supply',
                name: 'Water Supply Package',
                description: 'Clean drinking water for families',
                price: 150.00,
                impact_description: 'Provides water for 30 families for 1 week',
                icon: '💧'
            },
            {
                package_id: 'blanket-bundle',
                name: 'Blanket Bundle',
                description: 'Warm blankets for shelter',
                price: 250.00,
                impact_description: 'Provides 10 warm blankets for families in need',
                icon: '🛏️'
            },
            {
                package_id: 'cooking-oil',
                name: 'Cooking Oil Package',
                description: 'Essential cooking oil supply',
                price: 120.00,
                impact_description: 'Provides 10 bottles for community kitchen',
                icon: '🫗'
            },
            {
                package_id: 'rice-supply',
                name: 'Rice Supply Package',
                description: 'Staple food for families',
                price: 300.00,
                impact_description: 'Feeds 15 families for 1 month',
                icon: '🍚'
            },
            {
                package_id: 'medical-kit',
                name: 'Medical Kit Bundle',
                description: 'Complete medical supplies',
                price: 500.00,
                impact_description: 'Equips clinic with essential medical supplies',
                icon: '🏥'
            },
            {
                package_id: 'school-supplies',
                name: 'School Supply Package',
                description: 'Educational materials for children',
                price: 400.00,
                impact_description: 'Provides materials for 20 children',
                icon: '📚'
            },
            {
                package_id: 'emergency-food',
                name: 'Emergency Food Package',
                description: 'Nutritious emergency meals',
                price: 800.00,
                impact_description: 'Feeds 50 people for 1 week',
                icon: '🥫'
            },
            {
                package_id: 'hygiene-kit',
                name: 'Hygiene Kit Bundle',
                description: 'Personal care essentials',
                price: 350.00,
                impact_description: 'Provides hygiene items for 25 families',
                icon: '🧼'
            }
        ];

        for (const pkg of donationPackages) {
            await db.query(`
                INSERT INTO donation_packages (package_id, name, description, price, impact_description, icon) 
                VALUES (?, ?, ?, ?, ?, ?)
            `, [pkg.package_id, pkg.name, pkg.description, pkg.price, pkg.impact_description, pkg.icon]);
        }
        console.log('Initialized donation packages');
    }
}
// Initialize database connection and start server
async function initializeServer() {
    try {
        await connectDB();
        console.log('✅ Database initialization completed');
    } catch (err) {
        console.error('❌ Database initialization failed:', err);
        console.error('Server will continue without database functionality');
    }
}

// Start database initialization
initializeServer();

// --- Volunteer registration ---
app.post('/registerVolunteer', withValidation([
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name is required (max 100)'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('phone').optional().isLength({ min: 3, max: 20 }).withMessage('Phone length 3-20'),
    body('password').isLength({ min: 12 }).withMessage('Password must be at least 12 characters')
]), async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        if (!name || !email || !phone || !password) return res.json({ success: false, message: 'Missing fields' });

        // Password validation
        if (password.length < 6) {
            return res.json({ success: false, message: 'Password must be at least 6 characters long' });
        }

        // Check if database is connected
        if (!db) {
            console.error('Database not connected');
            return res.status(503).json({ success: false, message: 'Database connection unavailable' });
        }

        // Check if email already exists
        const [existing] = await db.query('SELECT * FROM volunteers WHERE email=?', [email]);
        if (existing.length > 0) {
            return res.json({ success: false, message: 'Email already registered' });
        }

        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        await db.query('INSERT INTO volunteers (name,email,phone,password_hash) VALUES (?,?,?,?)', [name, email, phone, password_hash]);
        res.json({ success: true, message: 'Registration successful' });
    } catch (err) {
        console.error('Volunteer registration error:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ENOTFOUND') {
            res.status(503).json({ success: false, message: 'Database connection lost' });
        } else {
            res.status(500).json({ success: false, message: 'Database error' });
        }
    }
});

// --- Volunteer login (session-based) ---
app.post('/login', loginLimiter, withValidation([
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 1 }).withMessage('Password required')
]), async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.json({ success: false, message: 'Email and password are required' });

        // Check if this is admin login (works without database)
        if (email === config.app.admin.email) {
            console.log('Admin login attempt for:', email);
            if (password === config.app.admin.password) {
                // Regenerate and set session
                return req.session.regenerate((err) => {
                    if (err) {
                        console.error('Session regenerate failed:', err);
                        return res.status(500).json({ success: false, message: 'Session error' });
                    }
                    req.session.user = { id: 'builtin-admin', email: config.app.admin.email, is_admin: true };
                    return res.json({
                        success: true,
                        user: {
                            id: 'builtin-admin',
                            name: 'Administrator',
                            email: config.app.admin.email,
                            isAdmin: true
                        }
                    });
                });
            } else {
                return res.json({ success: false, message: 'Invalid email or password' });
            }
        }

        // For regular users, check if database is connected
        if (!db) {
            console.error('Database not connected - regular user login unavailable');
            return res.status(503).json({ success: false, message: 'Database connection unavailable. Admin login still works.' });
        }

        // Find regular user by email
        const [rows] = await db.query('SELECT * FROM volunteers WHERE email=?', [email]);
        if (rows.length === 0) {
            return res.json({ success: false, message: 'Invalid email or password' });
        }

        const user = rows[0];

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.json({ success: false, message: 'Invalid email or password' });
        }

        // Set session
        return req.session.regenerate(async (err) => {
            if (err) {
                console.error('Session regenerate failed:', err);
                return res.status(500).json({ success: false, message: 'Session error' });
            }
            req.session.user = { id: user.id, email: user.email, is_admin: false };
            return res.json({
                success: true,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    isAdmin: false
                }
            });
        });
    } catch (err) {
        console.error('Login error:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ENOTFOUND') {
            res.status(503).json({ success: false, message: 'Database connection lost' });
        } else {
            res.status(500).json({ success: false, message: 'Database error' });
        }
    }
});

// --- Get timetable ---
app.get('/timetable', async (req, res) => {
    try {
        const [slots] = await db.query('SELECT slot, booked_by FROM slots');
        const [dates] = await db.query('SELECT week_start_date FROM schedule_dates ORDER BY created_at DESC LIMIT 1');

        res.json({
            slots: slots,
            weekStartDate: dates.length > 0 ? dates[0].week_start_date : null
        });
    } catch (err) {
        console.error(err);
        res.json({ slots: [], weekStartDate: null });
    }
});

// --- Book/release slot (new date-based system) ---
app.post('/book', withValidation([
    body('email').isEmail().normalizeEmail(),
    body('name').optional().trim().isLength({ max: 100 }),
    body('slot').isString().isLength({ min: 3, max: 50 })
]), async (req, res) => {
    try {
        const { email, name, slot } = req.body;
        if (!email || !slot) return res.json({ success: false, message: 'Missing fields' });

        // Check if slot already exists
        const [existing] = await db.query('SELECT * FROM slots WHERE slot=?', [slot]);

        if (existing.length === 0) {
            // Create new slot if it doesn't exist
            await db.query('INSERT INTO slots (slot, booked_by) VALUES (?,?)', [slot, email]);
            res.json({ success: true });
        } else {
            // Update existing slot
            const bookedBy = existing[0].booked_by;
            if (bookedBy && bookedBy !== email) return res.json({ success: false, message: 'Slot already booked by another user' });

            const newValue = bookedBy === email ? null : email;
            await db.query('UPDATE slots SET booked_by=? WHERE slot=?', [newValue, slot]);
            res.json({ success: true });
        }
    } catch (err) {
        console.error('Booking error:', err);
        res.json({ success: false, message: 'Database error' });
    }
});


// --- Update user profile ---
app.post('/updateProfile', withValidation([
    body('email').isEmail().normalizeEmail(),
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('phone').trim().isLength({ min: 3, max: 20 }),
    body('currentPassword').isLength({ min: 1 }),
    body('newPassword').optional({ nullable: true }).isLength({ min: 12 }).withMessage('New password must be at least 12 characters')
]), async (req, res) => {
    try {
        const { email, name, phone, currentPassword, newPassword } = req.body;
        if (!email || !name || !phone || !currentPassword) {
            return res.json({ success: false, message: 'Missing required fields' });
        }

        // Get user from database
        const [rows] = await db.query('SELECT * FROM volunteers WHERE email=?', [email]);
        if (rows.length === 0) {
            return res.json({ success: false, message: 'User not found' });
        }

        const user = rows[0];

        // Verify current password
        const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!passwordMatch) {
            return res.json({ success: false, message: 'Current password is incorrect' });
        }

        // Update user data
        let updateQuery = 'UPDATE volunteers SET name=?, phone=?';
        let updateParams = [name, phone];

        // If new password provided, hash it and include in update
        if (newPassword) {
            const saltRounds = 10;
            const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
            updateQuery += ', password_hash=?';
            updateParams.push(newPasswordHash);
        }

        updateQuery += ' WHERE email=?';
        updateParams.push(email);

        await db.query(updateQuery, updateParams);

        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// --- Admin reset timetable ---
app.post('/reset', requireAdmin, async (req, res) => {
    try {
        await db.query('UPDATE slots SET booked_by=NULL');
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }
});

// --- Logout ---
app.post('/logout', (req, res) => {
    if (!req.session) return res.json({ success: true });
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy failed:', err);
            return res.status(500).json({ success: false, message: 'Logout failed' });
        }
        res.clearCookie('sid');
        return res.json({ success: true });
    });
});

// --- Check if date is available for volunteering ---
app.post('/checkAvailability', withValidation([
    body('date').optional().isISO8601().withMessage('date must be ISO8601 (YYYY-MM-DD)')
]), async (req, res) => {
    try {
        const { date } = req.body;
        if (!date) return res.json({ available: true }); // Default to available if no date provided

        const [rows] = await db.query('SELECT * FROM unavailable_dates WHERE date=?', [date]);
        res.json({ available: rows.length === 0 });
    } catch (err) {
        console.error('Availability check error:', err);
        res.json({ available: true }); // Default to available on error
    }
});

// --- Auth middlewares ---
function requireAuth(req, res, next) {
    if (req.session && req.session.user) return next();
    return res.status(401).json({ success: false, message: 'Authentication required' });
}
function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.is_admin) return next();
    return res.status(403).json({ success: false, message: 'Admin access required' });
}

// --- Get all bookings for admin ---
app.get('/allBookings', requireAdmin, async (req, res) => {
    try {
        const [bookings] = await db.query(`
            SELECT s.slot, s.booked_by, 
                   COALESCE(v.name, 'Unknown User') as name 
            FROM slots s
            LEFT JOIN volunteers v ON s.booked_by = v.email
            WHERE s.booked_by IS NOT NULL 
            ORDER BY s.slot
        `);
        console.log('Found bookings:', bookings);
        res.json({ bookings: bookings });
    } catch (err) {
        console.error('Get bookings error:', err);
        res.json({ bookings: [] });
    }
});

// --- Get user's bookings ---
app.post('/myBookings', withValidation([
    body('email').isEmail().normalizeEmail()
]), async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.json({ bookings: [] });

        const [bookings] = await db.query(`
            SELECT slot, booked_by 
            FROM slots 
            WHERE booked_by = ? 
            ORDER BY slot
        `, [email]);
        res.json({ bookings: bookings });
    } catch (err) {
        console.error('Get user bookings error:', err);
        res.json({ bookings: [] });
    }
});

// --- Get unavailable dates ---
app.get('/getUnavailableDates', async (req, res) => {
    try {
        const [dates] = await db.query('SELECT DATE_FORMAT(date, "%Y-%m-%d") as date FROM unavailable_dates ORDER BY date');
        res.json({ dates: dates.map(row => row.date) });
    } catch (err) {
        console.error('Get unavailable dates error:', err);
        res.json({ dates: [] });
    }
});

// --- Set unavailable date (admin only) ---
app.post('/setUnavailableDate', requireAdmin, withValidation([
    body('date').isISO8601().withMessage('date must be ISO8601 (YYYY-MM-DD)')
]), async (req, res) => {
    try {
        const { date } = req.body;
        console.log('Set unavailable date request:', { date });



        if (!date) {
            console.log('Date missing');
            return res.json({ success: false, message: 'Date is required' });
        }

        // Insert unavailable date (ignore if already exists)
        console.log('Inserting unavailable date:', date);
        await db.query('INSERT IGNORE INTO unavailable_dates (date) VALUES (?)', [date]);
        console.log('Successfully inserted unavailable date');
        res.json({ success: true });
    } catch (err) {
        console.error('Set unavailable date error:', err);
        res.json({ success: false, message: 'Database error: ' + err.message });
    }
});

// --- Remove unavailable date (admin only) ---
app.post('/removeUnavailableDate', requireAdmin, withValidation([
    body('date').isISO8601().withMessage('date must be ISO8601 (YYYY-MM-DD)')
]), async (req, res) => {
    try {
        const { date } = req.body;
        console.log('Remove unavailable date request:', { date });



        if (!date) {
            console.log('Date missing for remove');
            return res.json({ success: false, message: 'Date is required' });
        }

        console.log('Attempting to delete unavailable date:', date);
        const [result] = await db.query('DELETE FROM unavailable_dates WHERE date=?', [date]);
        console.log('Delete result:', result);
        console.log('Rows affected:', result.affectedRows);

        res.json({ success: true, message: `Removed ${result.affectedRows} date(s)` });
    } catch (err) {
        console.error('Remove unavailable date error:', err);
        res.json({ success: false, message: 'Database error: ' + err.message });
    }
});

// --- Get donation packages (only existing packages since we use hard delete) ---
app.get('/donationPackages', async (req, res) => {
    // Disable caching so clients always get fresh data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    try {
        // No need to filter by is_active since hard delete removes packages completely
        const [packages] = await db.query('SELECT * FROM donation_packages ORDER BY price ASC');
        console.log('Retrieved packages for public view:', packages.length);
        res.json({ success: true, packages: packages });
    } catch (err) {
        console.error('Get donation packages error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// --- Process donation ---
app.post('/processDonation', withValidation([
    body('donationData').isObject(),
    body('donationData.total').isFloat({ gt: 0 }),
    body('donationData.items').isArray({ min: 1 }),
    body('donationData.items.*.id').isString().isLength({ min: 1, max: 50 }),
    body('donationData.items.*.name').isString().isLength({ min: 1, max: 100 }),
    body('donationData.items.*.price').isFloat({ gt: 0 }),
    body('donationData.items.*.quantity').isInt({ gt: 0 }),
    body('donorInfo.email').isEmail().normalizeEmail(),
    body('donorInfo.name').isString().isLength({ min: 1, max: 100 }),
    body('paymentInfo.cardName').isString().isLength({ min: 1, max: 100 }),
    body('paymentInfo.cardLast4').isLength({ min: 4, max: 4 }).isNumeric(),
    body('paymentInfo.expiryMonth').isInt({ min: 1, max: 12 }),
    body('paymentInfo.expiryYear').isInt({ min: 2000, max: 2100 })
]), async (req, res) => {
    try {
        const { donationData, donorInfo, paymentInfo } = req.body;

        if (!donationData || !donorInfo || !paymentInfo) {
            return res.json({ success: false, message: 'Missing required data' });
        }

        // Check if database is connected
        if (!db) {
            return res.status(503).json({ success: false, message: 'Database connection unavailable' });
        }

        // Start transaction
        await db.beginTransaction();

        try {
            // Get donor ID from volunteers table
            const [donor] = await db.query('SELECT id FROM volunteers WHERE email = ?', [donorInfo.email]);
            const donorId = donor.length > 0 ? donor[0].id : null;

            // Insert donation record
            const [donationResult] = await db.query(`
                INSERT INTO donations (transaction_id, donor_id, donor_email, donor_name, total_amount, status, payment_method, processed_at) 
                VALUES (?, ?, ?, ?, ?, 'completed', ?, NOW())
            `, [
                donationData.transactionId,
                donorId,
                donorInfo.email,
                donorInfo.name,
                donationData.total,
                JSON.stringify({
                    cardName: paymentInfo.cardName,
                    cardLast4: paymentInfo.cardLast4,
                    expiryMonth: paymentInfo.expiryMonth,
                    expiryYear: paymentInfo.expiryYear
                })
            ]);

            const donationDbId = donationResult.insertId;

            // Insert donation items
            for (const item of donationData.items) {
                await db.query(`
                    INSERT INTO donation_items (donation_id, package_id, package_name, price, quantity, subtotal, impact_description) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    donationDbId,
                    item.id,
                    item.name,
                    item.price,
                    item.quantity,
                    item.price * item.quantity,
                    item.impact
                ]);
            }

            // Commit transaction
            await db.commit();

            res.json({
                success: true,
                message: 'Donation processed successfully',
                transactionId: donationData.transactionId
            });

        } catch (error) {
            // Rollback transaction on error
            await db.rollback();
            throw error;
        }

    } catch (err) {
        console.error('Process donation error:', err);
        res.status(500).json({ success: false, message: 'Failed to process donation' });
    }
});

// --- Get user donations ---
app.post('/getUserDonations', withValidation([
    body('email').isEmail().normalizeEmail()
]), async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.json({ success: false, message: 'Email is required' });
        }

        // Get donations with items
        const [donations] = await db.query(`
            SELECT 
                d.id,
                d.transaction_id,
                d.total_amount,
                d.status,
                d.created_at,
                d.processed_at,
                GROUP_CONCAT(
                    JSON_OBJECT(
                        'id', di.package_id,
                        'name', di.package_name,
                        'price', di.price,
                        'quantity', di.quantity,
                        'impact', di.impact_description
                    ) SEPARATOR '|||'
                ) as items
            FROM donations d
            LEFT JOIN donation_items di ON d.id = di.donation_id
            WHERE d.donor_email = ?
            GROUP BY d.id
            ORDER BY d.created_at DESC
        `, [email]);

        // Parse the items JSON for each donation
        const processedDonations = donations.map(donation => ({
            ...donation,
            items: donation.items ? donation.items.split('|||').map(item => JSON.parse(item)) : []
        }));

        res.json({ success: true, donations: processedDonations });

    } catch (err) {
        console.error('Get user donations error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// --- Get donation statistics (admin) ---
app.get('/donationStats', requireAdmin, async (req, res) => {
    try {
        // Total donations
        const [totalResult] = await db.query('SELECT COUNT(*) as count, SUM(total_amount) as total FROM donations WHERE status = "completed"');

        // Recent donations
        const [recentDonations] = await db.query(`
            SELECT d.transaction_id, d.donor_name, d.total_amount, d.created_at
            FROM donations d
            WHERE d.status = 'completed'
            ORDER BY d.created_at DESC
            LIMIT 10
        `);

        // Popular packages
        const [popularPackages] = await db.query(`
            SELECT 
                di.package_name,
                SUM(di.quantity) as total_quantity,
                SUM(di.subtotal) as total_amount
            FROM donation_items di
            JOIN donations d ON di.donation_id = d.id
            WHERE d.status = 'completed'
            GROUP BY di.package_id, di.package_name
            ORDER BY total_quantity DESC
            LIMIT 5
        `);

        res.json({
            success: true,
            stats: {
                totalDonations: totalResult[0].count || 0,
                totalAmount: totalResult[0].total || 0,
                recentDonations: recentDonations,
                popularPackages: popularPackages
            }
        });

    } catch (err) {
        console.error('Get donation stats error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// --- Get all donations for admin ---
app.get('/getAllDonations', requireAdmin, async (req, res) => {
    try {
        // Check if database is connected
        if (!db) {
            return res.status(503).json({ success: false, message: 'Database connection unavailable' });
        }

        const [donations] = await db.query(`
            SELECT 
                d.id,
                d.transaction_id,
                d.donor_name,
                d.donor_email,
                d.total_amount,
                d.status,
                d.created_at,
                d.processed_at,
                d.payment_method
            FROM donations d
            ORDER BY d.created_at DESC
        `);

        // Safely process donations without complex JSON operations
        const processedDonations = donations.map(donation => {
            let parsedPaymentMethod = null;
            try {
                if (donation.payment_method && typeof donation.payment_method === 'string') {
                    parsedPaymentMethod = JSON.parse(donation.payment_method);
                }
            } catch (e) {
                console.log('Failed to parse payment_method for donation:', donation.id);
            }

            return {
                ...donation,
                payment_method: parsedPaymentMethod,
                items: [] // We'll fetch items separately if needed
            };
        });

        res.json({ success: true, donations: processedDonations });

    } catch (err) {
        console.error('Get all donations error:', err);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
});

// --- Get all donation packages (including inactive) for admin ---
app.get('/getAllDonationPackages', requireAdmin, async (req, res) => {
    // Disable caching for admin list
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    try {
        if (!db) {
            return res.status(503).json({ success: false, message: 'Database connection unavailable' });
        }

        const [packages] = await db.query('SELECT * FROM donation_packages ORDER BY created_at DESC');
        res.json({ success: true, packages: packages });

    } catch (err) {
        console.error('Get all donation packages error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// --- Create new donation package (admin) ---
app.post('/createDonationPackage', requireAdmin, withValidation([
    body('package_id').matches(/^[a-z0-9-]+$/).withMessage('package_id must be kebab-case'),
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('description').trim().isLength({ min: 1, max: 2000 }),
    body('price').isFloat({ gt: 0 }),
    body('impact_description').optional().isLength({ max: 4000 }),
    body('icon').optional().isLength({ max: 10 })
]), async (req, res) => {
    try {
        const { package_id, name, description, price, impact_description, icon } = req.body;

        if (!package_id || !name || !description || !price) {
            return res.json({ success: false, message: 'Missing required fields' });
        }

        if (!db) {
            return res.status(503).json({ success: false, message: 'Database connection unavailable' });
        }

        // Check if package_id already exists
        const [existing] = await db.query('SELECT * FROM donation_packages WHERE package_id = ?', [package_id]);
        if (existing.length > 0) {
            return res.json({ success: false, message: 'Package ID already exists' });
        }

        await db.query(`
            INSERT INTO donation_packages (package_id, name, description, price, impact_description, icon) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, [package_id, name, description, parseFloat(price), impact_description || '', icon || '📦']);

        res.json({ success: true, message: 'Donation package created successfully' });

    } catch (err) {
        console.error('Create donation package error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// --- Update donation package (admin) ---
app.put('/updateDonationPackage', requireAdmin, withValidation([
    body('id').isInt({ gt: 0 }).toInt(),
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('description').trim().isLength({ min: 1, max: 2000 }),
    body('price').isFloat({ gt: 0 }),
    body('impact_description').optional().isLength({ max: 4000 }),
    body('icon').optional().isLength({ max: 10 })
]), async (req, res) => {
    try {
        const { id, name, description, price, impact_description, icon } = req.body;

        if (!id || !name || !description || !price) {
            return res.json({ success: false, message: 'Missing required fields' });
        }

        if (!db) {
            return res.status(503).json({ success: false, message: 'Database connection unavailable' });
        }

        const [result] = await db.query(`
            UPDATE donation_packages 
            SET name = ?, description = ?, price = ?, impact_description = ?, icon = ?
            WHERE id = ?
        `, [name, description, parseFloat(price), impact_description || '', icon || '📦', id]);

        if (result.affectedRows === 0) {
            return res.json({ success: false, message: 'Package not found' });
        }

        res.json({ success: true, message: 'Donation package updated successfully' });

    } catch (err) {
        console.error('Update donation package error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// --- Delete donation package (admin) - TRUE HARD DELETE ---
app.delete('/deleteDonationPackage/:id', requireAdmin, withValidation([
    param('id').isInt({ gt: 0 }).toInt()
]), async (req, res) => {
    try {
        const { id } = req.params;
        console.log('DELETE request received for package ID:', id);




        if (!db) {
            console.log('Database not connected');
            return res.status(503).json({ success: false, message: 'Database connection unavailable' });
        }

        // Check if package exists first
        const [existingPackage] = await db.query('SELECT * FROM donation_packages WHERE id = ?', [id]);
        if (existingPackage.length === 0) {
            console.log('Package not found with ID:', id);
            return res.json({ success: false, message: 'Package not found' });
        }

        console.log('Found package to delete:', existingPackage[0].name);

        // HARD DELETE - Permanently remove from database
        const [result] = await db.query('DELETE FROM donation_packages WHERE id = ?', [id]);

        console.log('Delete result - affected rows:', result.affectedRows);

        if (result.affectedRows === 0) {
            return res.json({ success: false, message: 'Failed to delete package' });
        }

        console.log('Package successfully deleted from database');
        res.json({ success: true, message: 'Donation package permanently deleted' });

    } catch (err) {
        console.error('Delete donation package error:', err);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
});

// --- Events API endpoints ---

// Get all events
app.get('/events', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ success: false, message: 'Database connection unavailable' });
        }

        const [events] = await db.query(`
            SELECT * FROM events 
            WHERE published = TRUE 
            ORDER BY date ASC
        `);

        res.json({ success: true, events: events });

    } catch (err) {
        console.error('Get events error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Create new event (admin only)
app.post('/events', requireAdmin, withValidation([
    body('id').matches(/^[a-zA-Z0-9-]+$/).isLength({ min: 1, max: 50 }),
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('description').trim().isLength({ min: 1, max: 5000 }),
    body('date').isISO8601(),
    body('location').trim().isLength({ min: 1, max: 200 }),
    body('poster').optional().isString()
]), async (req, res) => {
    try {
        const { id, title, description, date, location, poster } = req.body;

        if (!id || !title || !description || !date || !location) {
            return res.json({ success: false, message: 'Missing required fields' });
        }

        if (!db) {
            return res.status(503).json({ success: false, message: 'Database connection unavailable' });
        }

        // Check if event ID already exists
        const [existing] = await db.query('SELECT * FROM events WHERE id = ?', [id]);
        if (existing.length > 0) {
            return res.json({ success: false, message: 'Event ID already exists' });
        }

        await db.query(`
            INSERT INTO events (id, title, description, date, location, poster, published, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, TRUE, 'admin')
        `, [id, title, description, date, location, poster]);

        res.json({ success: true, message: 'Event created successfully' });

    } catch (err) {
        console.error('Create event error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Update event (admin only)
app.put('/events/:id', requireAdmin, withValidation([
    param('id').matches(/^[a-zA-Z0-9-]+$/).isLength({ min: 1, max: 50 }),
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('description').trim().isLength({ min: 1, max: 5000 }),
    body('date').isISO8601(),
    body('location').trim().isLength({ min: 1, max: 200 }),
    body('poster').optional().isString()
]), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, date, location, poster } = req.body;

        if (!title || !description || !date || !location) {
            return res.json({ success: false, message: 'Missing required fields' });
        }

        if (!db) {
            return res.status(503).json({ success: false, message: 'Database connection unavailable' });
        }

        const [result] = await db.query(`
            UPDATE events 
            SET title = ?, description = ?, date = ?, location = ?, poster = ?, modified_by = 'admin'
            WHERE id = ?
        `, [title, description, date, location, poster, id]);

        if (result.affectedRows === 0) {
            return res.json({ success: false, message: 'Event not found' });
        }

        res.json({ success: true, message: 'Event updated successfully' });

    } catch (err) {
        console.error('Update event error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Delete event (admin only)
app.delete('/events/:id', requireAdmin, withValidation([
    param('id').matches(/^[a-zA-Z0-9-]+$/).isLength({ min: 1, max: 50 })
]), async (req, res) => {
    try {
        const { id } = req.params;
        if (!db) {
            return res.status(503).json({ success: false, message: 'Database connection unavailable' });
        }

        const [result] = await db.query('DELETE FROM events WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.json({ success: false, message: 'Event not found' });
        }

        res.json({ success: true, message: 'Event deleted successfully' });

    } catch (err) {
        console.error('Delete event error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// --- Delete donation record (admin) ---
app.delete('/deleteDonation/:id', requireAdmin, withValidation([
    param('id').isInt({ gt: 0 }).toInt()
]), async (req, res) => {
    try {
        const { id } = req.params;
        if (!db) {
            return res.status(503).json({ success: false, message: 'Database connection unavailable' });
        }

        // Start transaction to delete donation and its items
        await db.beginTransaction();

        try {
            // Delete donation items first (foreign key constraint)
            await db.query('DELETE FROM donation_items WHERE donation_id = ?', [id]);

            // Delete donation record
            const [result] = await db.query('DELETE FROM donations WHERE id = ?', [id]);

            if (result.affectedRows === 0) {
                await db.rollback();
                return res.json({ success: false, message: 'Donation not found' });
            }

            await db.commit();
            res.json({ success: true, message: 'Donation record deleted successfully' });

        } catch (error) {
            await db.rollback();
            throw error;
        }

    } catch (err) {
        console.error('Delete donation error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// --- Debug endpoint ---
app.get('/debug', async (req, res) => {
    try {
        if (!db) {
            return res.json({ error: 'Database not connected' });
        }

        // Test connection and transaction capability
        const [testQuery] = await db.query('SELECT 1 as test, NOW() as timestamp');

        // Test transaction support
        await db.beginTransaction();
        const [transactionTest] = await db.query('SELECT 2 as transaction_test');
        await db.rollback();

        res.json({
            success: true,
            connectionActive: true,
            transactionSupport: true,
            timestamp: testQuery[0].timestamp
        });
    } catch (err) {
        console.error('Debug error:', err);
        res.json({ error: err.message });
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
