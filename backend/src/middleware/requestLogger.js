const { prisma } = require('../lib/prisma');

/**
 * Async middleware — logs API requests to the DB after response is sent.
 * Non-blocking: uses 'finish' event on response to not add latency.
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    if (!req.userId || !req.apiKey?.id) return; // only log authenticated requests

    const log = {
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTimeMs: Date.now() - start,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
      userAgent: req.headers['user-agent'] || null,
      userId: req.userId,
      apiKeyId: req.apiKey.id,
    };

    // Fire-and-forget — never await inside middleware
    prisma.apiLog.create({ data: log }).catch((err) =>
      console.error('ApiLog write failed:', err.message)
    );
  });

  next();
};

module.exports = { requestLogger };
