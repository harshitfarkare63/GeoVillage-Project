const jwt = require('jsonwebtoken');
const { error } = require('../lib/response');

/**
 * JWT authentication middleware
 * Verifies Bearer token and attaches decoded payload to req.user
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return error(res, 'MISSING_TOKEN', 'Authorization header with Bearer token is required', 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'TOKEN_EXPIRED', 'JWT has expired. Please refresh your session.', 401);
    }
    return error(res, 'INVALID_TOKEN', 'JWT is invalid or malformed', 401);
  }
};

/**
 * RBAC guard — requires a specific role
 * Usage: requireRole('ADMIN')
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return error(res, 'UNAUTHENTICATED', 'Please authenticate first', 401);
  }
  if (!roles.includes(req.user.role)) {
    return error(res, 'FORBIDDEN', `This action requires one of: ${roles.join(', ')}`, 403);
  }
  next();
};

module.exports = { authenticate, requireRole };
