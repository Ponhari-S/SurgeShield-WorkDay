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

const fs = require('fs');
const path = require('path');

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error:', err);
});

async function initSchema() {
  try {
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(sql);
      console.log('[DB Schema] Tables and indexes verified/migrated successfully.');

      // Seed a default event & seats if table is empty
      const eventCheck = await pool.query('SELECT COUNT(*) FROM events');
      if (parseInt(eventCheck.rows[0].count, 10) === 0) {
        console.log('[DB Schema] Seeding initial default event and 100 seats...');
        const eventRes = await pool.query(
          `INSERT INTO events (name, description, venue, is_virtual, event_date, total_seats)
           VALUES ('SurgeShield Tech Summit 2026', 'High-throughput event demo', 'Grand Arena', false, NOW() + INTERVAL '30 days', 100)
           RETURNING id`
        );
        const eventId = eventRes.rows[0].id;
        const seatValues = [];
        for (let i = 1; i <= 100; i++) {
          const row = String.fromCharCode(65 + Math.floor((i - 1) / 10));
          const num = ((i - 1) % 10) + 1;
          seatValues.push(`(${eventId}, '${row}${num}')`);
        }
        await pool.query(`INSERT INTO seats (event_id, seat_label) VALUES ${seatValues.join(', ')}`);
        console.log('[DB Schema] Seeding complete (Event ID 1 created with 100 seats).');
      }
    }
  } catch (err) {
    console.warn('[DB Schema Init Warning]:', err.message);
  }
}

// Trigger schema initialization on load
initSchema();

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
  initSchema
};
