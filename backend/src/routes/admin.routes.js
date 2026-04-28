const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth');
const { success } = require('../lib/response');

const router = express.Router();
router.use(authenticate, requireRole('ADMIN'));

// GET /api/admin/users
router.get('/users', async (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const offset = Number(req.query.offset) || 0;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip: offset, take: limit,
      select: { id: true, name: true, email: true, role: true, plan: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count(),
  ]);

  success(res, users, { total, limit, offset });
});

// GET /api/admin/analytics
router.get('/analytics', async (req, res) => {
  const since = new Date(Date.now() - 24 * 3600000);

  const [totalRequests, errorRate, topUsers, avgLatency] = await Promise.all([
    prisma.apiLog.count({ where: { createdAt: { gte: since } } }),
    prisma.apiLog.count({ where: { createdAt: { gte: since }, statusCode: { gte: 400 } } }),
    prisma.$queryRaw`
      SELECT "userId", COUNT(*) as requests FROM api_logs
      WHERE "createdAt" >= ${since} GROUP BY "userId"
      ORDER BY requests DESC LIMIT 10
    `,
    prisma.$queryRaw`
      SELECT AVG("responseTimeMs") as avg_ms FROM api_logs
      WHERE "createdAt" >= ${since}
    `,
  ]);

  success(res, { totalRequests, errorRequests: errorRate, errorRate: ((errorRate / totalRequests) * 100).toFixed(2) + '%', avgLatencyMs: avgLatency[0]?.avg_ms, topUsers });
});

// GET /api/admin/health-data
router.get('/health-data', async (req, res) => {
  const [userCount, apiKeyCount, villageCount, logCount] = await Promise.all([
    prisma.user.count(),
    prisma.apiKey.count({ where: { isActive: true } }),
    prisma.village.count(),
    prisma.apiLog.count(),
  ]);

  success(res, { users: userCount, activeApiKeys: apiKeyCount, villages: villageCount, totalLogs: logCount });
});

module.exports = router;
