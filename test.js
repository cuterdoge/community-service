const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: 'hopper.proxy.rlwy.net',
      port: 24819,
      user: 'root',
      password: 'ZwyfKWCyvhMzzlCZxErLcIyvXEMJNoAD',
      database: 'railway',
      ssl: {
        rejectUnauthorized: false  // Key for Railway's self-signed certs
      },
      connectTimeout: 30000  // 30s timeout for proxy lag
    });

    const [rows] = await conn.execute('SELECT USER(), CURRENT_USER(), @@hostname as host, VERSION() as version');
    console.log('SUCCESS! Local connect works.');
    console.log('Connected as:', rows[0]['USER()']);
    console.log('Host seen by DB:', rows[0].host);
    console.log('MySQL Version:', rows[0].version);
    await conn.end();
  } catch (err) {
    console.error('FAILED:');
    console.error('Code:', err.code);
    console.error('Message:', err.message);
    console.error('Full:', err);
  }
})();