const express = require('express');
const crypto = require('crypto');
const { prisma } = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');
const { success, error } = require('../lib/response');

const router = express.Router();
router.use(authenticate);

const planLimits = {
  FREE: 1000,
  PREMIUM: 50000,
  PRO: 500000,
  UNLIMITED: -1,
};

// ─────────────────────────────────────────────
// POST /api/b2b/keys/generate
// ─────────────────────────────────────────────
router.post('/keys/generate', async (req, res) => {
  const userId = req.user.sub;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  // Generate raw key
  const rawKey = `gva_live_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const prefix = rawKey.slice(0, 20) + '...';

  const apiKey = await prisma.apiKey.create({
    data: {
      keyHash,
      prefix,
      plan: user.plan,
      dailyLimit: planLimits[user.plan] || 1000,
      userId,
    },
  });

  // Return raw key ONCE — not stored in DB
  success(res, {
    keyId: apiKey.id,
    apiKey: rawKey,  // Only shown once
    prefix,
    plan: apiKey.plan,
    dailyLimit: apiKey.dailyLimit,
    createdAt: apiKey.createdAt,
    warning: 'Store this key securely. It will not be shown again.',
  }, null, 201);
});

// ─────────────────────────────────────────────
// GET /api/b2b/keys
// ─────────────────────────────────────────────
router.get('/keys', async (req, res) => {
  const keys = await prisma.apiKey.findMany({
    where: { userId: req.user.sub },
    select: { id: true, prefix: true, plan: true, dailyLimit: true, isActive: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  success(res, keys);
});

// ─────────────────────────────────────────────
// DELETE /api/b2b/keys/:id  (revoke)
// ─────────────────────────────────────────────
router.delete('/keys/:id', async (req, res) => {
  const { id } = req.params;
  const key = await prisma.apiKey.findFirst({ where: { id, userId: req.user.sub } });
  if (!key) return error(res, 'NOT_FOUND', 'API key not found', 404);

  await prisma.apiKey.update({ where: { id }, data: { isActive: false } });
  success(res, { message: 'API key revoked successfully' });
});

// ─────────────────────────────────────────────
// GET /api/b2b/usage
// ─────────────────────────────────────────────
router.get('/usage', async (req, res) => {
  const userId = req.user.sub;
  const days = Number(req.query.days) || 7;
  const since = new Date(Date.now() - days * 86400000);

  const [total, byDay, byEndpoint] = await Promise.all([
    prisma.apiLog.count({ where: { userId, createdAt: { gte: since } } }),
    prisma.$queryRaw`
      SELECT DATE("createdAt") as date, COUNT(*) as requests, AVG("responseTimeMs") as avg_ms
      FROM api_logs WHERE "userId" = ${userId} AND "createdAt" >= ${since}
      GROUP BY DATE("createdAt") ORDER BY date ASC
    `,
    prisma.$queryRaw`
      SELECT endpoint, COUNT(*) as requests
      FROM api_logs WHERE "userId" = ${userId} AND "createdAt" >= ${since}
      GROUP BY endpoint ORDER BY requests DESC LIMIT 10
    `,
  ]);

  success(res, { totalRequests: total, byDay, byEndpoint });
});

module.exports = router;
