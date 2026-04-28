const express = require('express');
const router = express.Router();

const { validateApiKey } = require('../../middleware/validateApiKey');
const { rateLimiter } = require('../../middleware/rateLimiter');
const { requestLogger } = require('../../middleware/requestLogger');
const {
  getStates,
  getDistricts,
  getSubDistricts,
  getVillages,
  search,
  autocomplete,
} = require('../../controllers/geo.controller');

// Apply auth + rate limiting to all geo routes
router.use(validateApiKey);
router.use(rateLimiter);
router.use(requestLogger);

// Geographic hierarchy endpoints
router.get('/states', getStates);
router.get('/districts', getDistricts);
router.get('/subdistricts', getSubDistricts);
router.get('/villages', getVillages);

// Search & autocomplete
router.get('/search', search);
router.get('/autocomplete', autocomplete);

module.exports = router;
