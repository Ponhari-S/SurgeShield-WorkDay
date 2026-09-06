const express = require('express');
const client = require('prom-client');

const app = express();
const PORT = process.env.PORT || 3000;
const HOSTNAME = require('os').hostname();

app.use(express.json());

// Prometheus Metrics Setup
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

// Middleware for metrics logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    httpRequestCounter.inc({ method: req.method, route, status: res.statusCode });
    httpRequestDuration.observe({ method: req.method, route, status: res.statusCode }, duration);
  });
  next();
});

// Health check endpoints (Required for Swarm / ALB / Traefik)
app.get('/health/live', (req, res) => res.status(200).send('OK'));
app.get('/health/ready', (req, res) => res.status(200).json({ status: 'ready', instance: HOSTNAME }));

// Prometheus scrape endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Mock API Endpoints
app.get('/api/events', (req, res) => {
  res.json({
    instance: HOSTNAME,
    events: [
      { id: 'evt-1', title: 'Tech Surge Conference 2026', totalSeats: 100, availableSeats: 42, isVirtual: false, venue: 'Grand Arena' },
      { id: 'evt-2', title: 'Global Dev Summit (Virtual)', totalSeats: 10000, availableSeats: 9800, isVirtual: true }
    ]
  });
});

app.post('/api/registrations', (req, res) => {
  const idempotencyKey = req.headers['x-idempotency-key'] || 'none';
  // Simulate lightweight CPU work
  let sum = 0;
  for (let i = 0; i < 50000; i++) { sum += Math.sqrt(i); }

  res.status(201).json({
    success: true,
    registrationId: `reg-${Date.now()}-${Math.floor(Math.random()*1000)}`,
    idempotencyKey,
    processedByInstance: HOSTNAME,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`[API Stub] Running on instance ${HOSTNAME}:${PORT}`);
});
