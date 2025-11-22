// Centralized configuration
const config = {
    // Database configuration - Railway uses DB_* variables
    database: {
        host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
        user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
        password: process.env.DB_PASS || process.env.MYSQLPASSWORD || '',
        database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'volunteer_db',
        port: process.env.DB_PORT || process.env.MYSQLPORT || 3306,
        ssl: {
            rejectUnauthorized: false   // Required for Railway MySQL
        },
        connectTimeout: 30000,
        // acquireTimeout: 30000,
        // timeout: 30000,
        // reconnect: true,
        // maxReconnects: 3
    },
    
    // Server configuration
    server: {
        port: process.env.PORT || 3000,
        environment: process.env.NODE_ENV || 'development'
    },
    
    // Application configuration
    app: {
        // Admin configuration
        admin: {
            email: process.env.ADMIN_EMAIL || 'admin@communityhub.com',
            password: process.env.ADMIN_PASSWORD || 'admin123'
        }
    }
};

module.exports = config;