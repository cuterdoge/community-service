// // Centralized configuration
// const config = {
//     // Database configuration - support both DATABASE_URL and individual variables
//     database: process.env.DATABASE_URL || process.env.MYSQL_PUBLIC_URL ? {
//         // Use connection string if available (Railway preferred method)
//         uri: process.env.DATABASE_URL || process.env.MYSQL_PUBLIC_URL,
//         ssl: { rejectUnauthorized: false },
//         connectTimeout: 30000,
//         timezone: 'Z'
//     } : {
//         // Fallback to individual variables
//         host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
//         user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
//         password: process.env.DB_PASS || process.env.MYSQLPASSWORD || '',
//         database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'volunteer_db',
//         port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT || process.env.RAILWAY_TCP_PROXY_PORT || 3306),
//         ssl: { rejectUnauthorized: false },
//         connectTimeout: 30000,
//         timezone: 'Z'
//     },
    
//     // Server configuration
//     server: {
//         port: process.env.PORT || 3000,
//         environment: process.env.NODE_ENV || 'development'
//     },
    
//     // Application configuration
//     app: {
//         // Admin configuration
//         admin: {
//             email: process.env.ADMIN_EMAIL || 'admin@communityhub.com',
//             password: process.env.ADMIN_PASSWORD || 'admin123'
//         }
//     }
// };

// module.exports = config;


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