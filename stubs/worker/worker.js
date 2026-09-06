const express = require('express');
const client = require('prom-client');
const HOSTNAME = require('os').hostname();

const app = express();
const PORT = process.env.PORT || 3001;

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const queueDepthGauge = new client.Gauge({
  name: 'surgeshield_queue_depth',
  help: 'Number of pending background notification jobs in queue',
  registers: [register]
});

// Mock queue depth state
let currentQueueDepth = 0;
queueDepthGauge.set(currentQueueDepth);

app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.listen(PORT, () => {
  console.log(`[Worker Stub] Started background job processor on ${HOSTNAME}:${PORT}`);
});
