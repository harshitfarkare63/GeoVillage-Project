const { prisma } = require('../lib/prisma');
const { get, set } = require('../lib/redis');
const { success, error, paginate } = require('../lib/response');
const {
  stateQuerySchema,
  districtQuerySchema,
  subDistrictQuerySchema,
  villageQuerySchema,
  searchQuerySchema,
  autocompleteQuerySchema,
} = require('../validators/geo.validators');

// ─────────────────────────────────────────────
// GET /api/v1/states
// ─────────────────────────────────────────────
const getStates = async (req, res) => {
  const { limit, offset } = stateQuerySchema.parse(req.query);
  const cacheKey = `states:${limit}:${offset}`;
  const ttl = Number(process.env.CACHE_TTL_STATES) || 86400;

  let cached = await get(cacheKey);
  if (cached) return res.json(cached);

  const [states, total] = await Promise.all([
    prisma.state.findMany({
      skip: offset,
      take: limit,
      select: { id: true, name: true, code: true, countryId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.state.count(),
  ]);

  const response = { success: true, ...paginate(states, total, limit, offset), error: null };
  await set(cacheKey, response, ttl);
  res.json(response);
};

// ─────────────────────────────────────────────
// GET /api/v1/districts?stateId=
// ─────────────────────────────────────────────
const getDistricts = async (req, res) => {
  const { stateId, limit, offset } = districtQuerySchema.parse(req.query);
  const cacheKey = `districts:${stateId}:${limit}:${offset}`;
  const ttl = Number(process.env.CACHE_TTL_DISTRICTS) || 21600;

  let cached = await get(cacheKey);
  if (cached) return res.json(cached);

  const [districts, total] = await Promise.all([
    prisma.district.findMany({
      where: { stateId },
      skip: offset,
      take: limit,
      select: { id: true, name: true, stateId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.district.count({ where: { stateId } }),
  ]);

  const response = { success: true, ...paginate(districts, total, limit, offset), error: null };
  await set(cacheKey, response, ttl);
  res.json(response);
};

// ─────────────────────────────────────────────
// GET /api/v1/subdistricts?districtId=
// ─────────────────────────────────────────────
const getSubDistricts = async (req, res) => {
  const { districtId, limit, offset } = subDistrictQuerySchema.parse(req.query);
  const cacheKey = `subdistricts:${districtId}:${limit}:${offset}`;
  const ttl = Number(process.env.CACHE_TTL_SUBDISTRICTS) || 21600;

  let cached = await get(cacheKey);
  if (cached) return res.json(cached);

  const [subDistricts, total] = await Promise.all([
    prisma.subDistrict.findMany({
      where: { districtId },
      skip: offset,
      take: limit,
      select: { id: true, name: true, districtId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.subDistrict.count({ where: { districtId } }),
  ]);

  const response = { success: true, ...paginate(subDistricts, total, limit, offset), error: null };
  await set(cacheKey, response, ttl);
  res.json(response);
};

// ─────────────────────────────────────────────
// GET /api/v1/villages?subDistrictId=
// ─────────────────────────────────────────────
const getVillages = async (req, res) => {
  const { subDistrictId, limit, offset } = villageQuerySchema.parse(req.query);
  const cacheKey = `villages:${subDistrictId}:${limit}:${offset}`;
  const ttl = Number(process.env.CACHE_TTL_VILLAGES) || 300;

  let cached = await get(cacheKey);
  if (cached) return res.json(cached);

  const [villages, total] = await Promise.all([
    prisma.village.findMany({
      where: { subDistrictId },
      skip: offset,
      take: limit,
      select: { id: true, name: true, pincode: true, latitude: true, longitude: true, subDistrictId: true },
      orderBy: { name: 'asc' },
    }),
    prisma.village.count({ where: { subDistrictId } }),
  ]);

  const response = { success: true, ...paginate(villages, total, limit, offset), error: null };
  await set(cacheKey, response, ttl);
  res.json(response);
};

// ─────────────────────────────────────────────
// GET /api/v1/search?q=&type=
// Uses ILIKE search with optional trigram similarity boost
// ─────────────────────────────────────────────
const search = async (req, res) => {
  const { q, type, limit } = searchQuerySchema.parse(req.query);
  const cacheKey = `search:${q}:${type || 'all'}:${limit}`;
  const ttl = Number(process.env.CACHE_TTL_SEARCH) || 120;

  let cached = await get(cacheKey);
  if (cached) return res.json(cached);

  const results = [];
  const pattern = `%${q}%`;

  // Village search — try trigram first, fall back to ILIKE
  if (!type || type === 'village') {
    try {
      const villages = await prisma.$queryRaw`
        SELECT id, name, 'village' as type, "subDistrictId"
        FROM villages
        WHERE name % ${q} OR name ILIKE ${pattern}
        ORDER BY similarity(name, ${q}) DESC
        LIMIT ${limit}
      `;
      results.push(...villages);
    } catch (_trigramErr) {
      // pg_trgm not enabled — fall back to pure ILIKE
      const villages = await prisma.$queryRaw`
        SELECT id, name, 'village' as type, "subDistrictId"
        FROM villages
        WHERE name ILIKE ${pattern}
        ORDER BY name ASC
        LIMIT ${limit}
      `;
      results.push(...villages);
    }
  }

  // District search
  if (!type || type === 'district') {
    const districts = await prisma.$queryRaw`
      SELECT id, name, 'district' as type, "stateId"
      FROM districts
      WHERE name ILIKE ${pattern}
      ORDER BY name ASC
      LIMIT ${Math.ceil(limit / 3)}
    `;
    results.push(...districts);
  }

  // State search
  if (!type || type === 'state') {
    const states = await prisma.$queryRaw`
      SELECT id, name, 'state' as type
      FROM states
      WHERE name ILIKE ${pattern}
      ORDER BY name ASC
      LIMIT 10
    `;
    results.push(...states);
  }

  const response = { success: true, data: results.slice(0, limit), meta: { total: results.length }, error: null };
  await set(cacheKey, response, ttl);
  res.json(response);
};


// ─────────────────────────────────────────────
// GET /api/v1/autocomplete?q=
// ─────────────────────────────────────────────
const autocomplete = async (req, res) => {
  const { q } = autocompleteQuerySchema.parse(req.query);
  const cacheKey = `autocomplete:${q.toLowerCase()}`;
  const ttl = Number(process.env.CACHE_TTL_AUTOCOMPLETE) || 120;

  let cached = await get(cacheKey);
  if (cached) return res.json(cached);

  const villages = await prisma.village.findMany({
    where: { name: { contains: q, mode: 'insensitive' } },
    take: 10,
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const data = villages.map((v) => ({ id: v.id, label: v.name, type: 'village' }));
  const response = { success: true, data, error: null };
  await set(cacheKey, response, ttl);
  res.json(response);
};

module.exports = { getStates, getDistricts, getSubDistricts, getVillages, search, autocomplete };
