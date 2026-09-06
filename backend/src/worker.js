require('dotenv').config();
const express = require('express');
const { Worker, Queue } = require('bullmq');
const client = require('prom-client');
const db = require('./db');
const redisClient = require('./redis');

const PORT = process.env.PORT || 3001;
const HOSTNAME = require('os').hostname();

// ----------------------------------------------------
// Prometheus Metrics Setup (Exposed on /metrics)
// ----------------------------------------------------
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const queueDepthGauge = new client.Gauge({
  name: 'surgeshield_queue_depth',
  help: 'Number of pending/active background notification jobs in BullMQ queue',
  registers: [register]
});

const jobsProcessedCounter = new client.Counter({
  name: 'surgeshield_worker_jobs_processed_total',
  help: 'Total number of notification jobs successfully processed by worker',
  labelNames: ['status'],
  registers: [register]
});

// ----------------------------------------------------
// BullMQ Queue & Worker Setup
// ----------------------------------------------------
const notificationQueue = new Queue('notifications', {
  connection: redisClient.redisConnectionOptions
});

const worker = new Worker('notifications', async (job) => {
  const { outboxId, bookingId, type, payload } = job.data;
  console.log(`[BullMQ Worker ${HOSTNAME}] Processing Job #${job.id} for Booking #${bookingId} (${type})`);

  // Simulate sending email and generating calendar invite
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Update PostgreSQL outbox table record to processed
  if (outboxId) {
    await db.query(
      `UPDATE outbox_notifications 
       SET status = 'processed', processed_at = NOW() 
       WHERE id = $1`,
      [outboxId]
    );
  }

  jobsProcessedCounter.inc({ status: 'success' });
  return { status: 'sent', bookingId, processedBy: HOSTNAME };
}, {
  connection: redisClient.redisConnectionOptions,
  concurrency: 5
});

worker.on('completed', (job) => {
  console.log(`[BullMQ Worker ${HOSTNAME}] Job #${job.id} completed successfully.`);
});

worker.on('failed', async (job, err) => {
  console.error(`[BullMQ Worker ${HOSTNAME}] Job #${job?.id} failed:`, err.message);
  jobsProcessedCounter.inc({ status: 'failed' });

  if (job?.data?.outboxId) {
    try {
      await db.query(
        `UPDATE outbox_notifications 
         SET status = 'failed', error_message = $1 
         WHERE id = $2`,
        [err.message, job.data.outboxId]
      );
    } catch (e) {
      console.error('[Worker DB Update Error]:', e.message);
    }
  }
});

// ----------------------------------------------------
// Periodic Queue Depth Metric Sampler
// ----------------------------------------------------
setInterval(async () => {
  try {
    const counts = await notificationQueue.getJobCounts('waiting', 'active', 'delayed');
    const totalDepth = (counts.waiting || 0) + (counts.active || 0) + (counts.delayed || 0);
    queueDepthGauge.set(totalDepth);
  } catch (err) {
    // If Redis is unreachable, fallback to 0
    queueDepthGauge.set(0);
  }
}, 5000);

// ----------------------------------------------------
// Worker Health & Metrics Express App
// ----------------------------------------------------
const app = express();

app.get('/health', (req, res) => res.status(200).send('OK'));

app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).send(err.message);
  }
});

const server = app.listen(PORT, () => {
  console.log(`[BullMQ Worker Server] Running on ${HOSTNAME}:${PORT}`);
});

// Graceful Shutdown
async function shutdown() {
  console.log('[Worker] Draining BullMQ worker...');
  await worker.close();
  await notificationQueue.close();
  server.close(() => {
    console.log('[Worker] Server closed. Exit complete.');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
