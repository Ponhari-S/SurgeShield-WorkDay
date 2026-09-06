const { Queue } = require('bullmq');
const db = require('../db');
const redisClient = require('../redis');

let notificationQueue = null;
try {
  notificationQueue = new Queue('notifications', {
    connection: redisClient.redisConnectionOptions
  });
} catch (e) {
  console.warn('[NotificationService] BullMQ Queue init skipped:', e.message);
}

class NotificationService {
  // Transactional Outbox Insert (runs inside the Postgres booking transaction)
  async createOutboxNotification(client, { bookingId, type = 'EMAIL_AND_CALENDAR', payload }) {
    const query = `
      INSERT INTO outbox_notifications (booking_id, type, payload, status)
      VALUES ($1, $2, $3, 'pending')
      RETURNING *
    `;
    const res = await client.query(query, [bookingId, type, JSON.stringify(payload)]);
    return res.rows[0];
  }

  // Outbox Syncer Loop (flushes pending outbox notifications to BullMQ queue)
  async processOutbox() {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Use FOR UPDATE SKIP LOCKED to prevent multi-replica DB query amplification
      const pendingRes = await client.query(
        `SELECT * FROM outbox_notifications 
         WHERE status = 'pending' AND retry_count < 5 
         ORDER BY id ASC LIMIT 50
         FOR UPDATE SKIP LOCKED`
      );

      if (pendingRes.rows.length === 0) {
        await client.query('COMMIT');
        return;
      }

      for (const row of pendingRes.rows) {
        try {
          if (notificationQueue && redisClient.isReady()) {
            await notificationQueue.add('sendNotification', {
              outboxId: row.id,
              bookingId: row.booking_id,
              type: row.type,
              payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload
            }, {
              jobId: `outbox-${row.id}`,
              removeOnComplete: true,
              removeOnFail: false
            });

            await client.query(
              `UPDATE outbox_notifications 
               SET status = 'queued' 
               WHERE id = $1`,
              [row.id]
            );
          }
        } catch (err) {
          await client.query(
            `UPDATE outbox_notifications 
             SET retry_count = retry_count + 1, error_message = $1 
             WHERE id = $2`,
            [err.message, row.id]
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[NotificationService Outbox Syncer Error]:', err.message);
    } finally {
      client.release();
    }
  }
}

const service = new NotificationService();

// Start background outbox polling every 5 seconds
setInterval(() => {
  service.processOutbox();
}, 5000);

module.exports = service;
