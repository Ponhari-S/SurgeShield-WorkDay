require('dotenv').config();
const express = require('express');
const cors = require('cors');

const client = require('prom-client');
const eventsRouter = require('./routes/events');
const bookingsRouter = require('./routes/bookings');
const errorHandler = require('./middleware/errorHandler');
const db = require('./db');

const app = express();
app.use(cors({
  exposedHeaders: ['X-Idempotency-Key', 'X-Cache']
}));
app.use(express.json());

// ----------------------------------------------------
// Prometheus Metrics Setup (Exposed on /metrics)
// ----------------------------------------------------
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [register]
});

// Middleware for metrics tracking
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = (req.baseUrl && req.route)
      ? `${req.baseUrl}${req.route.path}`
      : (req.route ? req.route.path : req.path);
    httpRequestCounter.inc({ method: req.method, route, status: res.statusCode });
    httpRequestDuration.observe({ method: req.method, route, status: res.statusCode }, duration);
  });
  next();
});

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

// Prometheus scrape endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).send(err.message);
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

