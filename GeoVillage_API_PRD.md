# 🌍 GeoVillage API — Backend Product Requirements Document (PRD)

**Version:** 1.0.0  
**Status:** Draft  
**Platform:** SaaS (B2B)  
**Date:** April 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [System Architecture](#3-system-architecture)
4. [API Contract](#4-api-contract)
5. [Database Schema (ER Diagram)](#5-database-schema-er-diagram)
6. [Middleware Flow Design](#6-middleware-flow-design)
7. [Data Import Pipeline](#7-data-import-pipeline)
8. [Caching Strategy](#8-caching-strategy)
9. [Security Design](#9-security-design)
10. [Deployment Architecture](#10-deployment-architecture)
11. [Non-Functional Requirements](#11-non-functional-requirements)
12. [Analytics & Monitoring](#12-analytics--monitoring)
13. [Future Roadmap](#13-future-roadmap)

---

## 1. Executive Summary

**GeoVillage API** is a production-grade, multi-tenant B2B SaaS REST API platform that provides normalized, hierarchical village-level geographical data for India. It targets businesses that need reliable address validation, geographic lookup, and location intelligence at scale.

| Metric | Target |
|---|---|
| Daily Requests | 1,000,000+ |
| P95 API Latency | < 100ms |
| Uptime SLA | 99.9% |
| Village Records | 600,000+ |
| States Covered | 36 |
| Districts | 700+ |
| Sub-Districts | 6,000+ |

**Tech Stack:**

| Layer | Technology |
|---|---|
| Backend | Node.js + Express (Serverless) |
| ORM | Prisma |
| Database | PostgreSQL (NeonDB) |
| Cache | Redis (Upstash) |
| Frontend | React + Vite + Recharts |
| Auth | JWT + bcrypt |
| Rate Limiting | express-rate-limit + Redis |
| Hosting | Vercel Edge Network |

---

## 2. Problem Statement

Indian businesses currently lack a **standardized, reliable, and scalable** source of village-level address data. Existing solutions are:

- ❌ Inconsistent naming conventions across datasets
- ❌ No API-first design — mostly file downloads
- ❌ No real-time search or autocomplete
- ❌ Slow, undocumented, and poorly maintained
- ❌ Not suitable for B2B SaaS integration

**GeoVillage API solves this** with a normalized, indexed, API-first platform with enterprise-grade reliability.

---

## 3. System Architecture

### 3.1 Layered Architecture Diagram

```mermaid
graph TB
    subgraph CLIENT["🖥️ CLIENT LAYER"]
        A1[Admin Dashboard<br/>React SPA]
        A2[B2B Client Dashboard<br/>React SPA]
        A3[Public API Consumers<br/>3rd Party Apps]
    end

    subgraph EDGE["⚡ EDGE + API GATEWAY (Vercel Edge Network)"]
        B1[CORS Middleware]
        B2[API Key Validator]
        B3[JWT Validator]
        B4[Rate Limiter<br/>Redis-based]
        B5[Request Logger]
    end

    subgraph SERVERLESS["🚀 SERVERLESS BACKEND (Vercel Functions)"]
        C1["/api/v1/*<br/>Public Geo API"]
        C2["/api/auth/*<br/>Auth Routes"]
        C3["/api/b2b/*<br/>B2B Dashboard"]
        C4["/api/admin/*<br/>Admin Panel"]
    end

    subgraph DATA["🗄️ DATA LAYER"]
        D1[(PostgreSQL<br/>NeonDB)]
        D2[(Redis Cache<br/>Upstash)]
    end

    subgraph PIPELINE["🔄 DATA PIPELINE"]
        E1[MDDS Excel/CSV<br/>Dataset Upload]
        E2[Python ETL Engine<br/>Validation + Transform]
        E3[Batch Inserter<br/>5000 rows/chunk]
    end

    CLIENT --> EDGE
    EDGE --> SERVERLESS
    C1 & C2 & C3 & C4 --> DATA
    E1 --> E2 --> E3 --> D1
```

### 3.2 Request Lifecycle Overview

```mermaid
sequenceDiagram
    participant Client
    participant Edge as Vercel Edge
    participant Redis
    participant Server as Express Handler
    participant DB as PostgreSQL

    Client->>Edge: GET /api/v1/villages?subDistrictId=123
    Edge->>Redis: Validate API Key (cache lookup)
    Redis-->>Edge: Key Valid ✅
    Edge->>Redis: Rate limit check
    Redis-->>Edge: Under limit ✅
    Edge->>Server: Forward request
    Server->>Redis: Check cache for query
    alt Cache Hit
        Redis-->>Server: Return cached result
    else Cache Miss
        Server->>DB: Query villages WHERE subDistrict=123
        DB-->>Server: Return rows
        Server->>Redis: Cache result (TTL: 5min)
    end
    Server-->>Client: 200 JSON Response
    Server--)Redis: Async log request
```

---

## 4. API Contract

### 4.1 Base URL & Versioning

```
https://api.geovillage.in/api/v1/
```

All responses follow a **standardized envelope format:**

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "total": 1200,
    "limit": 50,
    "offset": 0,
    "page": 1
  },
  "error": null
}
```

---

### 4.2 Endpoint Reference

#### `GET /api/v1/states`
Returns all states in India.

**Request:**
```http
GET /api/v1/states
Authorization: Bearer <API_KEY>
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Maharashtra", "code": "MH", "countryId": 1 },
    { "id": 2, "name": "Uttar Pradesh", "code": "UP", "countryId": 1 }
  ],
  "meta": { "total": 36, "limit": 50, "offset": 0 }
}
```

---

#### `GET /api/v1/districts?stateId=1`
Returns districts for a given state.

**Query Params:**

| Param | Type | Required | Description |
|---|---|---|---|
| `stateId` | integer | ✅ | Filter by state ID |
| `limit` | integer | ❌ | Default: 50, Max: 200 |
| `offset` | integer | ❌ | Pagination offset |

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 101, "name": "Pune", "stateId": 1 },
    { "id": 102, "name": "Nashik", "stateId": 1 }
  ],
  "meta": { "total": 36, "limit": 50, "offset": 0 }
}
```

---

#### `GET /api/v1/subdistricts?districtId=101`

| Param | Type | Required |
|---|---|---|
| `districtId` | integer | ✅ |
| `limit` | integer | ❌ |
| `offset` | integer | ❌ |

---

#### `GET /api/v1/villages?subDistrictId=5001`

| Param | Type | Required |
|---|---|---|
| `subDistrictId` | integer | ✅ |
| `limit` | integer | ❌ |
| `offset` | integer | ❌ |

---

#### `GET /api/v1/search?q=pune&type=village`
Full-text fuzzy search across all geo entities.

| Param | Type | Required | Description |
|---|---|---|---|
| `q` | string | ✅ | Search term (min 2 chars) |
| `type` | string | ❌ | `state`, `district`, `subdistrict`, `village` |
| `limit` | integer | ❌ | Default: 20 |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 550123,
      "name": "Pune Village",
      "type": "village",
      "subDistrict": "Haveli",
      "district": "Pune",
      "state": "Maharashtra"
    }
  ]
}
```

---

#### `GET /api/v1/autocomplete?q=mumb`
Optimized for frontend typeahead — returns top 10 fuzzy-matched results instantly.

**Response:**
```json
{
  "success": true,
  "data": [
    { "label": "Mumbai", "type": "district", "id": 201 },
    { "label": "Mumbai Suburban", "type": "district", "id": 202 }
  ]
}
```

---

#### `POST /api/auth/register`
Register a new B2B user.

**Body:**
```json
{
  "name": "Acme Corp",
  "email": "admin@acme.com",
  "password": "securepassword123",
  "plan": "premium"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "usr_abc123",
    "token": "<JWT>",
    "apiKey": "gva_live_xxxxxxxxxxxx"
  }
}
```

---

#### `POST /api/auth/login`

**Body:**
```json
{ "email": "admin@acme.com", "password": "securepassword123" }
```

---

#### `POST /api/b2b/keys/generate`
Generate a new API key (authenticated).

**Headers:** `Authorization: Bearer <JWT>`

**Response:**
```json
{
  "success": true,
  "data": {
    "keyId": "key_xyz789",
    "apiKey": "gva_live_xxxxxxxxxxxx",
    "secret": "gva_secret_yyyyyyyyy",
    "plan": "premium",
    "rateLimit": 10000,
    "createdAt": "2026-04-28T00:00:00Z"
  }
}
```

---

#### Error Response Format

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "You have exceeded your daily quota of 10,000 requests.",
    "retryAfter": 3600
  }
}
```

**Error Codes:**

| Code | HTTP Status | Description |
|---|---|---|
| `INVALID_API_KEY` | 401 | API key missing or invalid |
| `RATE_LIMIT_EXCEEDED` | 429 | Quota exhausted |
| `VALIDATION_ERROR` | 400 | Bad input params |
| `NOT_FOUND` | 404 | Resource not found |
| `INTERNAL_ERROR` | 500 | Server-side failure |

---

## 5. Database Schema (ER Diagram)

```mermaid
erDiagram
    Country {
        int id PK
        string name
        string code
    }

    State {
        int id PK
        string name
        string code
        int countryId FK
    }

    District {
        int id PK
        string name
        int stateId FK
    }

    SubDistrict {
        int id PK
        string name
        int districtId FK
    }

    Village {
        int id PK
        string name
        string pincode
        float latitude
        float longitude
        int subDistrictId FK
    }

    User {
        string id PK
        string name
        string email
        string passwordHash
        string role
        string plan
        boolean isActive
        datetime createdAt
    }

    ApiKey {
        string id PK
        string keyHash
        string secretHash
        string userId FK
        string plan
        int dailyLimit
        int monthlyLimit
        boolean isActive
        datetime expiresAt
        datetime createdAt
    }

    ApiLog {
        string id PK
        string userId FK
        string apiKeyId FK
        string endpoint
        string method
        int statusCode
        int responseTimeMs
        string ipAddress
        datetime createdAt
    }

    UserStateAccess {
        string id PK
        string userId FK
        int stateId FK
        datetime grantedAt
    }

    Country ||--o{ State : "has"
    State ||--o{ District : "has"
    District ||--o{ SubDistrict : "has"
    SubDistrict ||--o{ Village : "has"
    User ||--o{ ApiKey : "owns"
    User ||--o{ ApiLog : "generates"
    User ||--o{ UserStateAccess : "has access"
    ApiKey ||--o{ ApiLog : "used in"
    State ||--o{ UserStateAccess : "restricted to"
```

### 5.1 Indexing Strategy

```sql
-- Trigram index for fuzzy search on village names
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_village_name_trgm ON "Village" USING GIN (name gin_trgm_ops);

-- Foreign key indexes for fast joins
CREATE INDEX idx_village_subdist ON "Village" (subDistrictId);
CREATE INDEX idx_subdist_dist ON "SubDistrict" (districtId);
CREATE INDEX idx_district_state ON "District" (stateId);
CREATE INDEX idx_state_country ON "State" (countryId);

-- Time-series index for API logs
CREATE INDEX idx_apilog_created ON "ApiLog" (createdAt DESC);
CREATE INDEX idx_apilog_user ON "ApiLog" (userId, createdAt DESC);

-- API key hash lookup
CREATE UNIQUE INDEX idx_apikey_hash ON "ApiKey" (keyHash);
```

---

## 6. Middleware Flow Design

```mermaid
flowchart TD
    A([Incoming Request]) --> B[CORS Handler]
    B --> C{Has API Key Header?}
    C -- No --> Z1[401 Unauthorized]
    C -- Yes --> D[Redis: Lookup API Key Hash]
    D --> E{Key Valid & Active?}
    E -- No --> Z2[401 Invalid Key]
    E -- Yes --> F[Redis: Rate Limit Check]
    F --> G{Under Quota?}
    G -- No --> Z3[429 Rate Limit Exceeded]
    G -- Yes --> H{Route requires JWT?}
    H -- Yes --> I[JWT Verification]
    I --> J{JWT Valid?}
    J -- No --> Z4[401 JWT Invalid]
    J -- Yes --> K[RBAC Role Check]
    K --> L{Authorized?}
    L -- No --> Z5[403 Forbidden]
    L -- Yes --> M[Input Validation & Sanitization]
    H -- No --> M
    M --> N{Valid Input?}
    N -- No --> Z6[400 Validation Error]
    N -- Yes --> O[Redis Cache Lookup]
    O --> P{Cache Hit?}
    P -- Yes --> Q[Return Cached Response]
    P -- No --> R[Prisma DB Query]
    R --> S[Format Response Envelope]
    S --> T[Set Cache TTL in Redis]
    T --> U[Return 200 Response]
    U --> V[Async: Write to ApiLog]
```

---

## 7. Data Import Pipeline

```mermaid
flowchart LR
    A[📂 MDDS Excel/CSV Upload<br/>Admin Dashboard] --> B[File Type Validator<br/>xlsx, csv only]
    B --> C[Schema Validator<br/>Check required columns]
    C --> D{Valid Schema?}
    D -- No --> E[❌ Reject with Error Report]
    D -- Yes --> F[Data Cleaner<br/>Trim, normalize encoding]
    F --> G[Deduplication Engine<br/>Check by name + parent ID]
    G --> H[Hierarchical Mapper<br/>Country → State → District<br/>→ SubDistrict → Village]
    H --> I[Batch Chunker<br/>5000 rows per chunk]
    I --> J[Prisma Batch Upsert<br/>PostgreSQL transaction]
    J --> K{Insert Success?}
    K -- No --> L[Log Error + Retry<br/>Max 3 attempts]
    K -- Yes --> M[Integrity Verifier<br/>Count validation]
    L --> J
    M --> N[✅ Import Report Generated<br/>Success/Fail counts, Errors]
```

### 7.1 ETL Script Spec (Python)

```python
# Pseudocode for ETL Pipeline
import pandas as pd
import psycopg2
from batching import chunk_dataframe

def run_pipeline(filepath: str):
    df = pd.read_excel(filepath) if filepath.endswith('.xlsx') else pd.read_csv(filepath)
    
    validate_schema(df)          # Assert required columns exist
    df = clean_data(df)          # Normalize strings, strip whitespace
    df = deduplicate(df)         # Drop duplicates on (name, parent_id)
    
    for chunk in chunk_dataframe(df, size=5000):
        try:
            upsert_batch(chunk)  # Prisma / raw SQL batch insert
            log_success(chunk)
        except Exception as e:
            log_error(chunk, e)
            retry(chunk, max=3)
    
    verify_integrity()           # Row count check vs DB
    generate_report()
```

---

## 8. Caching Strategy

| Cache Key Pattern | TTL | Description |
|---|---|---|
| `states:all` | 24h | All states list |
| `districts:state:{id}` | 6h | Districts for a state |
| `subdistricts:district:{id}` | 6h | Subdistricts for a district |
| `villages:subdist:{id}` | 5m | Villages for a subdistrict |
| `search:{q}:{type}` | 2m | Search results |
| `autocomplete:{q}` | 2m | Autocomplete results |
| `apikey:{hash}` | 10m | API key validation result |
| `ratelimit:{userId}:{day}` | 24h | Daily usage counter |

**Cache Invalidation:** TTL-based. Admin data imports trigger manual key purge via `SCAN + DEL` pattern.

---

## 9. Security Design

```mermaid
flowchart TD
    A[Security Layer] --> B[API Key System]
    A --> C[JWT Authentication]
    A --> D[Rate Limiting]
    A --> E[Input Sanitization]
    A --> F[SQL Injection Prevention]

    B --> B1[SHA-256 Key Hashing]
    B --> B2[Prefix-based Key Format<br/>gva_live_ / gva_test_]
    B --> B3[Key Rotation Support]

    C --> C1[RS256 Signed JWTs]
    C --> C2[Short expiry: 1 hour]
    C --> C3[Refresh Token: 7 days]

    D --> D1[Per-user daily quota]
    D --> D2[Per-IP burst protection<br/>100 req/min]
    D --> D3[Redis sliding window counter]

    E --> E1[Zod schema validation]
    E --> E2[Parameterized queries via Prisma]

    F --> F1[Prisma ORM prevents raw SQL injection]
    F --> F2[No dynamic SQL concatenation]
```

### 9.1 Plan-based Rate Limits

| Plan | Daily Requests | Max RPS | Price |
|---|---|---|---|
| Free | 1,000 | 5 | ₹0 |
| Premium | 50,000 | 50 | ₹999/mo |
| Pro | 500,000 | 200 | ₹4,999/mo |
| Unlimited | Unlimited | 1,000 | Custom |

---

## 10. Deployment Architecture

```mermaid
graph TB
    subgraph INTERNET["🌐 Internet"]
        U[B2B Clients / Browsers]
    end

    subgraph VERCEL["⚡ Vercel Edge Network (Global CDN)"]
        V1[Edge Functions<br/>CORS, Auth, Rate Limit]
        V2[Serverless Functions<br/>Node.js + Express]
        V3[Static Frontend<br/>React + Vite]
    end

    subgraph NEON["🗄️ NeonDB (Serverless PostgreSQL)"]
        N1[Primary DB<br/>Read + Write]
        N2[Read Replica<br/>Geo Queries]
    end

    subgraph UPSTASH["⚡ Upstash Redis (Global)"]
        R1[Rate Limit Store]
        R2[Query Cache]
        R3[API Key Cache]
    end

    subgraph MONITORING["📊 Monitoring"]
        M1[Vercel Analytics]
        M2[Custom ApiLog Table]
        M3[Error Alerting<br/>Sentry / BetterStack]
    end

    U --> VERCEL
    V1 --> V2
    V2 --> NEON
    V2 --> UPSTASH
    V2 --> MONITORING
```

### 10.1 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@neon.tech/geovillage

# Redis
UPSTASH_REDIS_URL=https://xxx.upstash.io
UPSTASH_REDIS_TOKEN=xxx

# Auth
JWT_SECRET=<256-bit-secret>
JWT_EXPIRY=3600

# App
NODE_ENV=production
API_VERSION=v1
```

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Requirement | Target | Strategy |
|---|---|---|
| P95 API Latency | < 100ms | Redis cache + trigram index |
| P99 API Latency | < 300ms | NeonDB connection pooling |
| Cold Start | < 500ms | Serverless warm-up |
| DB Query Time | < 20ms | Indexed joins |

### 11.2 Scalability

- **Stateless design** — all state in Redis/DB, not in-memory
- **Serverless functions** scale automatically with traffic
- **NeonDB autoscaling** — scales compute on-demand
- **Upstash Redis** — globally replicated, auto-scales

### 11.3 Reliability

```mermaid
flowchart LR
    A[Health Checks] --> B[GET /api/health]
    B --> C{DB Ping OK?}
    B --> D{Redis Ping OK?}
    C & D --> E[200 OK]
    C -- fail --> F[503 Degraded]

    G[Retry Logic] --> H[Exponential Backoff]
    H --> I[Max 3 retries on DB timeout]

    J[Graceful Shutdown] --> K[Drain active connections]
    K --> L[Close DB pool]
```

---

## 12. Analytics & Monitoring

### 12.1 ApiLog Schema Usage

The `ApiLog` table drives all analytics:

```sql
-- Top endpoints by usage
SELECT endpoint, COUNT(*) as hits, AVG(responseTimeMs) as avg_ms
FROM "ApiLog"
WHERE createdAt > NOW() - INTERVAL '24 hours'
GROUP BY endpoint
ORDER BY hits DESC;

-- Per-user usage
SELECT userId, COUNT(*) as requests
FROM "ApiLog"
WHERE DATE(createdAt) = CURRENT_DATE
GROUP BY userId;
```

### 12.2 Dashboard Metrics

**Admin Panel:**
- Total requests / day, week, month
- Error rate (4xx / 5xx breakdown)
- Top users by consumption
- Data import history

**B2B Dashboard:**
- API key usage (requests used vs. quota)
- Response time trend (line chart)
- Top endpoints called
- Subscription plan & renewal date

---

## 13. Future Roadmap

| Phase | Feature | Priority |
|---|---|---|
| v1.1 | GraphQL API layer | High |
| v1.2 | Bulk validation endpoint | High |
| v1.3 | JavaScript SDK | Medium |
| v1.4 | Python SDK | Medium |
| v2.0 | Multi-country support | High |
| v2.1 | AI-powered fuzzy search (embeddings) | Medium |
| v2.2 | Webhook support for data updates | Low |
| v2.3 | Pincode → Village reverse lookup | Medium |

---

> **Document Owner:** Backend Engineering Team  
> **Review Cycle:** Per major version release  
> **Last Updated:** April 2026
