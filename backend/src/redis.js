const Redis = require('ioredis');
require('dotenv').config();

let redis = null;
let isConnected = false;

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const parsedUrl = new URL(redisUrl);
const redisConnectionOptions = {
  host: parsedUrl.hostname || 'localhost',
  port: parseInt(parsedUrl.port || '6379', 10),
  username: parsedUrl.username || undefined,
  password: parsedUrl.password || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  retryStrategy(times) {
    return Math.min(times * 100, 3000); // Continuous backoff capped at 3s
  }
};

try {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      return Math.min(times * 100, 3000);
    }
  });

  redis.on('connect', () => {
    isConnected = true;
    console.log('[Redis] Connected successfully to Redis server');
  });

  redis.on('error', (err) => {
    if (isConnected) console.warn('[Redis] Connection warning:', err.message);
    isConnected = false;
  });
} catch (err) {
  console.warn('[Redis] Redis client initialization skipped:', err.message);
}

module.exports = {
  redis,
  redisConnectionOptions,
  isReady: () => isConnected && redis && redis.status === 'ready',
  
  // Tier 1 Fast-Path Redis Lock for Specific Seat
  // Command: SET lock:seat:<eventId>:<seatId> <userId> NX EX 30
  async acquireSeatLock(eventId, seatId, userId, ttlSeconds = 30) {
    if (!isConnected || !redis || redis.status !== 'ready') {
      return true; // Bypass Redis tier if Redis unavailable, fallback directly to DB tier
    }
    try {
      const lockKey = `lock:seat:${eventId}:${seatId}`;
      const result = await redis.set(lockKey, userId, 'NX', 'EX', ttlSeconds);
      return result === 'OK';
    } catch (err) {
      console.error('[Redis Lock Error]:', err.message);
      return true; // Fallback to DB
    }
  },

  async releaseSeatLock(eventId, seatId, userId) {
    if (!isConnected || !redis || redis.status !== 'ready') return;
    try {
      const lockKey = `lock:seat:${eventId}:${seatId}`;
      const val = await redis.get(lockKey);
      if (val === userId) {
        await redis.del(lockKey);
      }
    } catch (err) {
      console.error('[Redis Unlock Error]:', err.message);
    }
  }
};
