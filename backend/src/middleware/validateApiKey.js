const crypto  = require('crypto');
const jwt      = require('jsonwebtoken');
const { get, set } = require('../lib/redis');
const { prisma } = require('../lib/prisma');
const { error }  = require('../lib/response');

/**
 * Hash an API key using SHA-256 (fast, safe for lookup)
 */
const hashApiKey = (key) =>
  crypto.createHash('sha256').update(key).digest('hex');

/**
 * Middleware: Validate API Key from X-API-Key header OR JWT Bearer token.
 *
 * Priority:
 *   1. X-API-Key header  — standard client usage
 *   2. Authorization: Bearer <jwt> — dashboard / API Explorer usage
 *
 * On success, attaches req.apiKey, req.userId, req.user to request.
 */
const validateApiKey = async (req, res, next) => {
  const rawKey = req.headers['x-api-key'];

  // ── PATH 1: X-API-Key header (standard) ──────────────────────────────
  if (rawKey) {
    const keyHash  = hashApiKey(rawKey);
    const cacheKey = `apikey:${keyHash}`;
    const ttl      = Number(process.env.CACHE_TTL_APIKEY) || 600;

    let keyData = await get(cacheKey);

    if (!keyData) {
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
        id:         apiKey.id,
        userId:     apiKey.userId,
        plan:       apiKey.plan,
        dailyLimit: apiKey.dailyLimit,
        userRole:   apiKey.user.role,
        userName:   apiKey.user.name,
      };

      await set(cacheKey, keyData, ttl);

      prisma.apiKey.update({
        where: { id: apiKey.id },
        data:  { lastUsedAt: new Date() },
      }).catch(() => {});
    }

    req.apiKey = keyData;
    req.userId = keyData.userId;
    req.user   = { id: keyData.userId, plan: keyData.plan, role: keyData.userRole, name: keyData.userName };
    return next();
  }

  // ── PATH 2: JWT Bearer token (dashboard / API Explorer) ───────────────
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Look up the user's first active API key to populate billing context
      const apiKey = await prisma.apiKey.findFirst({
        where:   { userId: decoded.userId || decoded.id, isActive: true },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      });

      if (!apiKey) {
        // User authenticated but has no API key yet — still allow with JWT identity
        req.apiKey = { id: null, userId: decoded.userId || decoded.id, plan: decoded.plan || 'FREE', dailyLimit: 1000, userRole: decoded.role, userName: decoded.name };
        req.userId = decoded.userId || decoded.id;
        req.user   = { id: decoded.userId || decoded.id, plan: decoded.plan || 'FREE', role: decoded.role, name: decoded.name };
        return next();
      }

      const keyData = {
        id:         apiKey.id,
        userId:     apiKey.userId,
        plan:       apiKey.plan,
        dailyLimit: apiKey.dailyLimit,
        userRole:   apiKey.user.role,
        userName:   apiKey.user.name,
      };

      req.apiKey = keyData;
      req.userId = keyData.userId;
      req.user   = { id: keyData.userId, plan: keyData.plan, role: keyData.userRole, name: keyData.userName };
      return next();

    } catch (_err) {
      return error(res, 'Invalid or expired token', 401);
    }
  }

  // ── Neither provided ──────────────────────────────────────────────────
  return error(res, 'Authentication required: provide X-API-Key header or Bearer token', 401);
};

module.exports = { validateApiKey, hashApiKey };
