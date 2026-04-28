const Redis = require('ioredis');

let redis;

const createRedisClient = () => {
  const url = process.env.REDIS_URL;

  // ioredis: when URL scheme is `rediss://`, TLS is handled automatically.
  // Do NOT pass a separate `tls` option — it causes double-TLS with Upstash.
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 5) return null; // stop retrying after 5 attempts
      return Math.min(times * 200, 2000);
    },
    // lazyConnect: false so the connection is established at startup
    enableReadyCheck: false, // Upstash doesn't send LOADING errors, skip ready check
    connectTimeout: 10000,
  });

  client.on('connect', () => console.log('✅ Redis connected to Upstash'));
  client.on('ready',   () => console.log('✅ Redis ready'));
  client.on('error',   (err) => console.error('❌ Redis error:', err.message));
  client.on('close',   () => console.warn('⚠️  Redis connection closed'));

  return client;
};

if (!global.__redis) {
  global.__redis = createRedisClient();
}

redis = global.__redis;

// ─────────────────────────────────────────────
// CACHE HELPERS
// ─────────────────────────────────────────────

const get = async (key) => {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null; // cache miss on error — degrade gracefully
  }
};

const set = async (key, value, ttlSeconds) => {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // non-fatal — continue without caching
  }
};

const del = async (key) => {
  try {
    await redis.del(key);
  } catch { /* ignore */ }
};

const increment = async (key, ttlSeconds) => {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, ttlSeconds);
  return count;
};

module.exports = { redis, get, set, del, increment };
