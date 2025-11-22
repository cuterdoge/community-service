# Railway CLI Testing Guide

## Prerequisites

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login to Railway:
```bash
railway login
```

## Testing Your Application

### 1. Local Development with Railway Database
```bash
# Link your project to Railway
railway link

# Pull environment variables from Railway
railway variables

# Run locally with Railway environment
railway run npm start
```

### 2. Deploy to Railway
```bash
# Deploy current directory
railway up

# Deploy and watch logs
railway up --detach=false

# Or deploy with custom start command
railway up --start="npm start"
```

### 3. View Logs
```bash
# View live logs
railway logs

# View logs with follow
railway logs --follow

# View specific service logs
railway logs --service=<service-name>
```

### 4. Environment Variables
```bash
# List all variables
railway variables

# Set a variable
railway variables set KEY=value

# Delete a variable
railway variables delete KEY
```

### 5. Database Management
```bash
# Connect to Railway database
railway connect mysql

# Run database migrations/queries
railway run mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME
```

### 6. Testing Endpoints
```bash
# Get your Railway URL
railway domain

# Test endpoints (replace <your-app-url> with actual URL)
curl https://<your-app-url>.railway.app/
curl https://<your-app-url>.railway.app/timetable
```

### 7. Local Testing with Railway Environment
```bash
# Start with Railway environment variables
railway run node server.js

# Or start with specific port
railway run PORT=3000 node server.js
```

## Common Commands

- `railway status` - Check deployment status
- `railway open` - Open your app in browser
- `railway shell` - Open shell with Railway environment
- `railway logs --tail=100` - View last 100 log lines
- `railway restart` - Restart your service

## Troubleshooting

### SSL Connection Issues
- Ensure your `.env` has the correct Railway MySQL credentials
- SSL is automatically handled by the updated server.js

### Timeout Issues
- The server now includes connection timeouts (30s)
- Database queries have timeout handling
- HTTP server has appropriate timeout settings

### Database Connection
```bash
# Test database connectivity
railway run node -e "
const mysql = require('mysql2/promise');
require('dotenv').config();
(async () => {
  try {
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
      ssl: { rejectUnauthorized: false }
    });
    console.log('Database connection successful!');
    await db.end();
  } catch(err) {
    console.error('Database connection failed:', err.message);
  }
})();
"
```