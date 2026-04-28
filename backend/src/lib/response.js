/**
 * Standardized API response envelope
 */

const success = (res, data, meta = null, statusCode = 200) => {
  const response = { success: true, data, error: null };
  if (meta) response.meta = meta;
  return res.status(statusCode).json(response);
};

const error = (res, code, message, statusCode = 400, extra = {}) => {
  return res.status(statusCode).json({
    success: false,
    data: null,
    error: { code, message, ...extra },
  });
};

const paginate = (data, total, limit, offset) => ({
  data,
  meta: {
    total,
    limit: Number(limit),
    offset: Number(offset),
    page: Math.floor(offset / limit) + 1,
    hasMore: offset + limit < total,
  },
});

module.exports = { success, error, paginate };
