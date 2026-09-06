const redisClient = require('../redis');

// Combined Idempotency Middleware (Redis Fast-Path Cache + Locking)
async function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers['x-idempotency-key'];

  // If no idempotency key provided, bypass idempotency check
  if (!idempotencyKey) {
    return next();
  }

  const redisKey = `idempotency:${idempotencyKey}`;

  try {
    // 1. Check if key exists in Redis
    if (redisClient.isReady()) {
      const existingVal = await redisClient.redis.get(redisKey);

      if (existingVal) {
        if (existingVal === 'PROCESSING') {
          return res.status(409).json({
            error: 'A request with this X-Idempotency-Key is currently processing. Please wait.'
          });
        }

        // Return cached original response payload
        try {
          const cachedResponse = JSON.parse(existingVal);
          res.setHeader('X-Cache', 'HIT');
          return res.status(cachedResponse.status || 200).json(cachedResponse.body);
        } catch (e) {
          // If JSON parse fails, continue execution
        }
      }

      // 2. Mark key as PROCESSING in Redis with 30s TTL
      const setSuccess = await redisClient.redis.set(redisKey, 'PROCESSING', 'NX', 'EX', 30);
      if (!setSuccess) {
        return res.status(409).json({
          error: 'Concurrent duplicate request detected.'
        });
      }
    }

    // 3. Intercept res.json / res.send to cache response on success
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && redisClient.isReady()) {
        const payloadToCache = JSON.stringify({
          status: res.statusCode,
          body
        });
        // Cache response payload for 24 hours (86400 seconds)
        redisClient.redis.setex(redisKey, 86400, payloadToCache).catch(err => {
          console.error('[Idempotency Cache Error]:', err.message);
        });
      } else if (res.statusCode >= 400 && redisClient.isReady()) {
        // Clear PROCESSING lock on client error so user can retry
        redisClient.redis.del(redisKey).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  } catch (err) {
    console.error('[Idempotency Middleware Error]:', err.message);
    next();
  }
}

module.exports = idempotencyMiddleware;
