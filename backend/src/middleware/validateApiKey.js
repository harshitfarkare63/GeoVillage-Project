const crypto = require('crypto');
const { get, set } = require('../lib/redis');
const { prisma } = require('../lib/prisma');
const { error } = require('../lib/response');

/**
 * Hash an API key using SHA-256 (fast, safe for lookup)
 */
const hashApiKey = (key) =>
  crypto.createHash('sha256').update(key).digest('hex');

/**
 * Middleware: Validate API Key from X-API-Key header
 * - Looks up hash in Redis first (cache), then DB fallback
 * - Gracefully degrades if Redis is unavailable or read-only
 * - Attaches req.apiKey, req.userId, req.user to request
 */
const validateApiKey = async (req, res, next) => {
  const rawKey = req.headers['x-api-key'];
  if (!rawKey) {
    return error(res, 'X-API-Key header is required', 401);
  }

  const keyHash   = hashApiKey(rawKey);
  const cacheKey  = `apikey:${keyHash}`;
  const ttl       = Number(process.env.CACHE_TTL_APIKEY) || 600;

  // 1. Try Redis cache (non-fatal if unavailable)
  let keyData = await get(cacheKey); // get() never throws — returns null on error

  if (!keyData) {
    // 2. DB lookup
    const apiKey = await prisma.apiKey.findUnique({
      where:   { keyHash },
      include: { user: true },
    });

    if (!apiKey || !apiKey.isActive || !apiKey.user.isActive) {
      return error(res, 'API key is invalid or revoked', 401);
    }

    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return error(res, 'API key has expired', 401);
    }

    keyData = {
      id:        apiKey.id,
      userId:    apiKey.userId,
      plan:      apiKey.plan,
      dailyLimit: apiKey.dailyLimit,
      userRole:  apiKey.user.role,
      userName:  apiKey.user.name,
    };

    // Cache for TTL seconds (non-fatal if Redis is read-only)
    await set(cacheKey, keyData, ttl); // set() never throws

    // Update last used (async, non-blocking)
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data:  { lastUsedAt: new Date() },
    }).catch(() => {});
  }

  req.apiKey = keyData;
  req.userId = keyData.userId;
  req.user   = { id: keyData.userId, plan: keyData.plan, role: keyData.userRole, name: keyData.userName };
  next();
};

module.exports = { validateApiKey, hashApiKey };
