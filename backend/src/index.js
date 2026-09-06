require('dotenv').config();
const express = require('express');
const cors = require('cors');

const eventsRouter = require('./routes/events');
const bookingsRouter = require('./routes/bookings');
const errorHandler = require('./middleware/errorHandler');
const db = require('./db');

const app = express();
app.use(cors({
  exposedHeaders: ['X-Idempotency-Key', 'X-Cache']
}));
app.use(express.json());

// Health & Readiness Probes for Traefik / Docker Swarm
app.get('/health/live', (req, res) => res.status(200).send('OK'));

app.get('/health/ready', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});

app.use('/api/events', eventsRouter);
app.use('/api/bookings', bookingsRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`SurgeShield backend running on port ${PORT}`);
});

// Graceful Shutdown Handler (Zero 502 Errors on Scale-In)
function gracefulShutdown(signal) {
  console.log(`[Backend] ${signal} received. Starting graceful shutdown...`);
  server.close(() => {
    console.log('[Backend] HTTP server closed. Draining DB pool...');
    db.pool.end(() => {
      console.log('[Backend] DB pool closed. Exit complete.');
      process.exit(0);
    });
  });

  // Force exit after 10s timeout
  setTimeout(() => {
    console.error('[Backend] Could not close connections in time, forcing exit.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

