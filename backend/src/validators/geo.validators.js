const { z } = require('zod');

// Reusable pagination schema
const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const stateQuerySchema = paginationSchema;

const districtQuerySchema = paginationSchema.extend({
  stateId: z.coerce.number().int().positive('stateId must be a positive integer'),
});

const subDistrictQuerySchema = paginationSchema.extend({
  districtId: z.coerce.number().int().positive('districtId must be a positive integer'),
});

const villageQuerySchema = paginationSchema.extend({
  subDistrictId: z.coerce.number().int().positive('subDistrictId must be a positive integer'),
});

const searchQuerySchema = z.object({
  q: z.string().min(2, 'Query must be at least 2 characters').max(100),
  type: z.enum(['state', 'district', 'subdistrict', 'village']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const autocompleteQuerySchema = z.object({
  q: z.string().min(2, 'Query must be at least 2 characters').max(50),
});

module.exports = {
  stateQuerySchema,
  districtQuerySchema,
  subDistrictQuerySchema,
  villageQuerySchema,
  searchQuerySchema,
  autocompleteQuerySchema,
};
