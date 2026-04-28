require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const { errorHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/requestLogger');
const geoRoutes = require('./routes/v1/geo.routes');
const authRoutes = require('./routes/auth.routes');
const b2bRoutes = require('./routes/b2b.routes');
const adminRoutes = require('./routes/admin.routes');
const healthRoutes = require('./routes/health.routes');

const app = express();
const PORT = process.env.PORT || 4000;

// ─────────────────────────────────────────────
// CORE MIDDLEWARE
// ─────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────
app.use('/health', healthRoutes);
app.use('/api/v1', geoRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/b2b', b2bRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
});

// ─────────────────────────────────────────────
// ERROR HANDLER (must be last)
// ─────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 GeoVillage API running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV}`);
  console.log(`📡 API Version: ${process.env.API_VERSION || 'v1'}\n`);
});

module.exports = app;
