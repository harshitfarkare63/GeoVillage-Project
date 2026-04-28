/**
 * Global error handler — must be the last middleware in the chain
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err);

  // Prisma known errors
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Requested resource not found' },
    });
  }

  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      data: null,
      error: { code: 'CONFLICT', message: 'A resource with this value already exists' },
    });
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: err.errors,
      },
    });
  }

  // Default 500
  res.status(500).json({
    success: false,
    data: null,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'An internal error occurred'
        : err.message,
    },
  });
};

module.exports = { errorHandler };
