const { increment } = require('../lib/redis');
const { error } = require('../lib/response');

// Plan daily limits
const PLAN_LIMITS = {
  FREE:      1_000,
  PREMIUM:  50_000,
  PRO:     500_000,
  UNLIMITED: Infinity,
};

/**
 * Redis-based daily rate limiter with sliding window.
 * Degrades gracefully if Redis is read-only (e.g. Upstash default_ro user).
 */
const rateLimiter = async (req, res, next) => {
  const user = req.user;
  if (!user) return next(); // auth middleware handles missing users

  const limit = PLAN_LIMITS[user.plan] ?? PLAN_LIMITS.FREE;
  if (limit === Infinity) return next(); // UNLIMITED plan — skip check

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key   = `ratelimit:${user.id}:${today}`;
  const ttl   = 86400; // 24 hours

  try {
    const count = await increment(key, ttl);

    // Set headers so clients can see their usage
    res.set('X-RateLimit-Limit',     String(limit));
    res.set('X-RateLimit-Remaining', String(Math.max(0, limit - count)));
    res.set('X-RateLimit-Reset',     getEndOfDayEpoch());

    if (count > limit) {
      return error(res, 'Daily rate limit exceeded', 429, {
        limit,
        used: count,
        resetAt: getEndOfDayEpoch(),
        retryAfter: `${getSecondsUntilMidnight()}s`,
      });
    }
  } catch (err) {
    // Redis write failed (read-only user or connection issue) — allow request
    console.warn(`⚠️  Rate limiter degraded: ${err.message} — allowing request`);
  }

  return next();
};

// ── Helpers ──────────────────────────────────────────────
function getEndOfDayEpoch() {
  const eod = new Date();
  eod.setUTCHours(23, 59, 59, 999);
  return Math.floor(eod.getTime() / 1000);
}

function getSecondsUntilMidnight() {
  const now = new Date();
  const midnight = new Date();
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.floor((midnight - now) / 1000);
}

module.exports = { rateLimiter };
