// Central Postgres connection pool.
// Every service/controller should import `query`/`getClient` from here
// instead of creating its own pool, so pool config stays in one place.
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://surgeshield:surgeshield_pass@localhost:5432/surgeshield_db',
  // SSL is disabled by default for local/Docker container Postgres. Set DB_SSL=true if connecting to a remote TLS DB.
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // EXTENSION POINT: hook this into alerting (Slack/PagerDuty) later
  console.error('Unexpected Postgres pool error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(), // used when a transaction is needed
  pool,
};
