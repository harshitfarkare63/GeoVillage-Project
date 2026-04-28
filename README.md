# 🌍 GeoVillage API

> Production-grade B2B SaaS REST API providing normalized, hierarchical village-level geographical data for India.

[![Node.js](https://img.shields.io/badge/Node.js-20+-green)](https://nodejs.org)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-blue)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-NeonDB-blue)](https://neon.tech)
[![Redis](https://img.shields.io/badge/Redis-Upstash-red)](https://upstash.com)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black)](https://vercel.com)

---

## 📦 Project Structure

```
VILLAGES_Project/
├── backend/                    # Node.js + Express API
│   ├── prisma/
│   │   └── schema.prisma       # Database schema (9 tables)
│   ├── src/
│   │   ├── index.js            # App entry point
│   │   ├── lib/
│   │   │   ├── prisma.js       # Prisma singleton client
│   │   │   ├── redis.js        # Redis client + helpers
│   │   │   └── response.js     # Standardized response envelope
│   │   ├── middleware/
│   │   │   ├── validateApiKey.js  # API key auth (Redis + DB)
│   │   │   ├── rateLimiter.js     # Per-user daily quota
│   │   │   ├── auth.js            # JWT + RBAC
│   │   │   ├── requestLogger.js   # Async ApiLog writer
│   │   │   └── errorHandler.js    # Global error handler
│   │   ├── routes/
│   │   │   ├── v1/geo.routes.js   # GET states/districts/villages
│   │   │   ├── auth.routes.js     # Register / Login / Me
│   │   │   ├── b2b.routes.js      # API key management + usage
│   │   │   ├── admin.routes.js    # Admin-only analytics
│   │   │   └── health.routes.js   # Health checks
│   │   ├── controllers/
│   │   │   └── geo.controller.js  # All geo endpoint logic
│   │   └── validators/
│   │       └── geo.validators.js  # Zod schemas
│   ├── .env.example
│   └── package.json
│
├── etl/
│   └── etl_pipeline.py         # Python MDDS dataset importer
│
├── vercel.json                 # Deployment configuration
├── package.json                # Monorepo root
└── .gitignore
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Python 3.10+ (for ETL)
- NeonDB account → [neon.tech](https://neon.tech)
- Upstash Redis account → [upstash.com](https://upstash.com)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/geovillage-api.git
cd geovillage-api

# Install backend dependencies
cd backend && npm install
```

### 2. Configure Environment

```bash
cp backend/.env.example backend/.env
# Fill in DATABASE_URL, REDIS_URL, JWT_SECRET
```

### 3. Set Up Database

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate

# Enable trigram extension (run in NeonDB SQL editor):
# CREATE EXTENSION IF NOT EXISTS pg_trgm;
# CREATE INDEX idx_village_name_trgm ON villages USING GIN (name gin_trgm_ops);
```

### 4. Import Village Data (ETL)

```bash
cd etl
pip install pandas openpyxl psycopg2-binary python-dotenv
python etl_pipeline.py /path/to/MDDS_dataset.xlsx
```

### 5. Start Development Server

```bash
cd backend
npm run dev
# Server running at http://localhost:4000
```

---

## 📡 API Endpoints

### Geo Hierarchy (requires X-API-Key header)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/states` | All states |
| `GET` | `/api/v1/districts?stateId=1` | Districts for a state |
| `GET` | `/api/v1/subdistricts?districtId=101` | Sub-districts |
| `GET` | `/api/v1/villages?subDistrictId=5001` | Villages |
| `GET` | `/api/v1/search?q=pune` | Fuzzy search |
| `GET` | `/api/v1/autocomplete?q=mumb` | Typeahead |

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create B2B account |
| `POST` | `/api/auth/login` | Login + get JWT |
| `GET` | `/api/auth/me` | Get current user |

### B2B Dashboard (JWT required)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/b2b/keys/generate` | Generate API key |
| `GET` | `/api/b2b/keys` | List my API keys |
| `DELETE` | `/api/b2b/keys/:id` | Revoke key |
| `GET` | `/api/b2b/usage` | Usage analytics |

### Admin (JWT + ADMIN role)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/users` | List all users |
| `GET` | `/api/admin/analytics` | Platform analytics |
| `GET` | `/api/admin/health-data` | DB/Cache stats |

### System

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | DB + Redis health check |

---

## 🔐 Authentication Flow

```
1. Register/Login → receive JWT
2. Generate API Key (B2B dashboard)  
3. Use X-API-Key header for all geo endpoints
4. Use Authorization: Bearer <JWT> for dashboard endpoints
```

---

## 📊 Rate Limiting

| Plan | Daily Requests | Per-minute burst |
|---|---|---|
| Free | 1,000 | 20 |
| Premium | 50,000 | 200 |
| Pro | 500,000 | 1,000 |
| Unlimited | ∞ | ∞ |

Rate limit headers returned on every response:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `Retry-After` (on 429)

---

## 🗄️ Database Scale

| Entity | Count |
|---|---|
| Countries | 1 (India) |
| States | 36 |
| Districts | 700+ |
| Sub-Districts | 6,000+ |
| Villages | 600,000+ |

---

## 🌐 Deployment (Vercel)

```bash
npm i -g vercel
vercel login
vercel --prod
```

Set these in Vercel Environment Variables:
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `NODE_ENV=production`

---

## 📄 License
MIT © GeoVillage API
