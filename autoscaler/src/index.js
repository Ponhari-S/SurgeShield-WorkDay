const express = require('express');
const PrometheusClient = require('./prometheusClient');
const SwarmScaler = require('./swarmScaler');

const app = express();
const PORT = process.env.PORT || 9091;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);

const promClient = new PrometheusClient(process.env.PROMETHEUS_URL);
const scaler = new SwarmScaler({
  socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock',
  cooldownTicks: parseInt(process.env.COOLDOWN_TICKS || '6', 10) // 6 ticks * 5s = 30s cooldown
});

let lastMetrics = {
  rps: 0,
  cpu: 0,
  queueDepth: 0,
  lastCheckTime: null
};

// Polling loop
async function runScalingCycle() {
  try {
    const rps = await promClient.getApiRps();
    const cpu = await promClient.getApiCpuUsage();
    const queueDepth = await promClient.getWorkerQueueDepth();

    lastMetrics = {
      rps,
      cpu,
      queueDepth,
      lastCheckTime: new Date().toISOString()
    };

    console.log(`[Autoscaler Tick ${lastMetrics.lastCheckTime}] RPS: ${rps.toFixed(1)} | CPU: ${cpu.toFixed(1)}% | Queue: ${queueDepth}`);

    // Evaluate API Scaling
    await scaler.evaluateApiScaling({
      rps,
      cpu,
      minReplicas: parseInt(process.env.MIN_API_REPLICAS || '2', 10),
      maxReplicas: parseInt(process.env.MAX_API_REPLICAS || '15', 10),
      highRpsPerNode: parseFloat(process.env.HIGH_RPS_PER_NODE || '30'),
      highCpuPct: parseFloat(process.env.HIGH_CPU_PCT || '30'),
      lowRpsPerNode: parseFloat(process.env.LOW_RPS_PER_NODE || '10'),
      lowCpuPct: parseFloat(process.env.LOW_CPU_PCT || '10')
    });

    // Evaluate Worker Scaling
    await scaler.evaluateWorkerScaling({
      queueDepth,
      minReplicas: parseInt(process.env.MIN_WORKER_REPLICAS || '1', 10),
      maxReplicas: parseInt(process.env.MAX_WORKER_REPLICAS || '10', 10),
      highQueueDepth: parseInt(process.env.HIGH_QUEUE_DEPTH || '500', 10),
      lowQueueDepth: parseInt(process.env.LOW_QUEUE_DEPTH || '50', 10)
    });

  } catch (err) {
    console.error('[Autoscaler Loop Error]:', err.message);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Current autoscaler status endpoint
app.get('/status', async (req, res) => {
  const apiReplicas = await scaler.getServiceReplicas('api');
  const workerReplicas = await scaler.getServiceReplicas('worker');

  res.json({
    status: 'active',
    pollIntervalMs: POLL_INTERVAL_MS,
    cooldownTicks: scaler.cooldownTrackers.api.requiredTicksForScaleDown,
    currentReplicas: {
      api: apiReplicas,
      worker: workerReplicas
    },
    cooldownState: scaler.cooldownTrackers,
    metrics: lastMetrics
  });
});

app.listen(PORT, () => {
  console.log(`[Autoscaler Engine] Started on port ${PORT}`);
  console.log(`[Autoscaler Engine] Polling Prometheus every ${POLL_INTERVAL_MS}ms...`);
  
  // Initial run & start interval
  runScalingCycle();
  setInterval(runScalingCycle, POLL_INTERVAL_MS);
});
