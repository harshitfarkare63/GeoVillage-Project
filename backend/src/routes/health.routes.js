const express = require('express');
const { prisma } = require('../lib/prisma');
const { redis } = require('../lib/redis');

const router = express.Router();

// GET /health
router.get('/', async (req, res) => {
  const start = Date.now();
  const checks = { status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() };

  // Database ping
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'healthy', latencyMs: Date.now() - start };
  } catch {
    checks.database = { status: 'unhealthy' };
    checks.status = 'degraded';
  }

  // Redis ping
  try {
    const rStart = Date.now();
    await redis.ping();
    checks.cache = { status: 'healthy', latencyMs: Date.now() - rStart };
  } catch {
    checks.cache = { status: 'unhealthy' };
    checks.status = 'degraded';
  }

  res.status(checks.status === 'ok' ? 200 : 503).json(checks);
});

module.exports = router;
