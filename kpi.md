# KPI API — Production Documentation

**Domain:** Beyond Limits Learning Hub — Analytics & Reporting  
**Architectural Style:** REST  
**Base URL:** `https://<host>/api`  
**API Version:** v1 (implicit — no version prefix; breaking changes will introduce `/v2/kpi/`)  
**Transport:** HTTPS only  
**Auth Scheme:** Session cookie (`better-auth` session token) + optional `Authorization: Bearer <token>` header

---

## 1. Domain Context

The KPI subsystem exposes read-only aggregate analytics over five domains:

| Domain | Description |
|--------|-------------|
| Completion Rate | Ratio of completed course-lesson and short-video progress records to total assignments |
| Assignment Success | Ratio of assignments where the learner started (has ≥1 progress record) |
| Content Popularity | Top-10 courses and shorts ranked by assignments and unique watchers |
| Ticket Stats | Support ticket volume, type breakdown, and resolution time distribution |
| Account Tiers | Distribution and growth of `role=user` accounts across `free / develop / master` tiers |

All endpoints are **aggregate-only** — no PII row-level data is exposed.

---

## 2. RBAC Model

### 2.1 Role Hierarchy

```
admin  ← full access to all KPI endpoints
  └── trainer  ← no access
  └── trainee  ← no access
  └── user     ← no access
```

### 2.2 Permissions Matrix

| Endpoint | admin | trainer | trainee | user |
|----------|:-----:|:-------:|:-------:|:----:|
| GET /kpi/completion-rate | ✅ | ❌ | ❌ | ❌ |
| GET /kpi/assignment-success | ✅ | ❌ | ❌ | ❌ |
| GET /kpi/content-popularity | ✅ | ❌ | ❌ | ❌ |
| GET /kpi/ticket-stats | ✅ | ❌ | ❌ | ❌ |
| GET /kpi/account-tiers | ✅ | ❌ | ❌ | ❌ |

### 2.3 Enforcement Logic

**Stage 1 — Authentication:**  
Every request must carry a valid session. The server calls `auth.api.getSession()`. If no session exists → `401 Unauthorized`.

**Stage 2 — Authorization:**  
After session resolution, `user.role` is checked. If `role !== "admin"` → `403 Forbidden`.  
No permission plugin check is used (role string comparison is sufficient — KPI is admin-exclusive).

**Stage 3 — No resource ownership check:**  
KPI endpoints return aggregate data — there is no per-resource ownership concept.

---

## 3. Common Conventions

### 3.1 Date Range Parameters

All five endpoints accept optional `from` and `to` query parameters.

| Parameter | Type | Format | Default |
|-----------|------|--------|---------|
| `from` | string (ISO 8601) | `YYYY-MM-DDTHH:mm:ssZ` | 30 days before `now` |
| `to` | string (ISO 8601) | `YYYY-MM-DDTHH:mm:ssZ` | `now` |

- If `from` > `to`, results will be empty (no error is thrown — MongoDB range returns 0 docs).
- Timezone: UTC assumed. Clients must send UTC or ISO strings with offset.

### 3.2 Response Envelope

All responses follow the shared `sendSuccess` / `sendError` envelope:

**Success:**
```json
{
  "success": true,
  "message": "<human-readable message>",
  "data": { ... },
  "meta": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "<error description>",
  "errors": { ... }
}
```

### 3.3 Headers

| Header | Required | Value |
|--------|----------|-------|
| `Cookie` | Yes (session) | `better-auth.session_token=<token>` |
| `Authorization` | Optional | `Bearer <token>` |
| `Content-Type` | N/A | No request body on GET endpoints |

---

## 4. Endpoint Specifications

---

### 4.1 `GET /api/kpi/completion-rate`

**Purpose:** Returns the ratio of completed course-lesson and short-video progress records to total assignments in the given period. Also returns current user distribution by `accountType`.

**Required Role:** `admin`

#### Request

| Parameter | In | Type | Required | Description |
|-----------|----|------|----------|-------------|
| `from` | query | ISO 8601 string | No | Start of period. Default: 30 days ago |
| `to` | query | ISO 8601 string | No | End of period. Default: now |

#### Business Logic (Step-by-Step)

1. Validate session → verify `role === "admin"`.
2. Parse `from` / `to` into `Date` objects.
3. Run four parallel MongoDB queries:
   - Count `LessonVideoProgress` docs where `completed=true` and `updatedAt` in range.
   - Count `ShortVideoProgress` docs where `completed=true` and `updatedAt` in range.
   - Count `CourseAssignment` docs where `createdAt` in range.
   - Count `ShortAssignment` docs where `createdAt` in range.
4. Query `user` collection (native MongoDB) for `role=user`, group by `accountType`.
5. Compute rates: `completedCount / totalAssigned * 100` (0 if `totalAssigned = 0`).
6. Return assembled payload.

**Side Effects:** None — read-only.  
**Idempotency:** Fully idempotent.  
**Transactional Boundary:** None — eventual consistency across collections is acceptable for analytics.

#### Success Response `200`

```json
{
  "success": true,
  "message": "Completion rate fetched",
  "data": {
    "period": {
      "from": "2025-04-07T00:00:00.000Z",
      "to": "2025-05-07T00:00:00.000Z"
    },
    "courses": {
      "totalAssigned": 120,
      "completed": 84,
      "completionRate": 70.00
    },
    "shorts": {
      "totalAssigned": 340,
      "completed": 289,
      "completionRate": 85.00
    },
    "usersByAccountType": [
      { "accountType": "develop", "count": 45 },
      { "accountType": "free", "count": 210 },
      { "accountType": "master", "count": 30 }
    ]
  }
}
```

#### Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| No assignments in period | `totalAssigned: 0`, `completionRate: 0` |
| No users with `role=user` | `usersByAccountType: []` |
| `from` and `to` same day | Valid — narrow window, likely low counts |

---

### 4.2 `GET /api/kpi/assignment-success`

**Purpose:** Measures engagement — what percentage of assignments resulted in the learner actually starting the content (at least one progress record exists).

**Required Role:** `admin`

#### Request

| Parameter | In | Type | Required |
|-----------|----|------|----------|
| `from` | query | ISO 8601 | No |
| `to` | query | ISO 8601 | No |

#### Business Logic (Step-by-Step)

1. Validate session → `role === "admin"`.
2. Fetch all `CourseAssignment` docs created in range (fields: `assignedToId`, `profileId`, `courseId`).
3. Fetch all `ShortAssignment` docs created in range (fields: `assignedToId`, `profileId`, `shortVideoId`).
4. For each course assignment: query `LessonVideoProgress.exists({ userId: assignedToId, courseId })`.
5. For each short assignment: query `ShortVideoProgress.exists({ trackingId: profileId || assignedToId, shortVideoId })`.
6. Count truthy results → `started`.
7. Compute `successRate = started / totalAssigned * 100`.

**Performance Note:** Steps 4–5 fire N parallel `exists()` queries (one per assignment). This is bounded by the date range. For large datasets, consider adding a `$lookup`-based aggregation pipeline if period spans > 90 days.

**Side Effects:** None.

#### Success Response `200`

```json
{
  "success": true,
  "message": "Assignment success rate fetched",
  "data": {
    "period": {
      "from": "2025-04-07T00:00:00.000Z",
      "to": "2025-05-07T00:00:00.000Z"
    },
    "courses": {
      "totalAssigned": 120,
      "started": 98,
      "successRate": 81.67
    },
    "shorts": {
      "totalAssigned": 340,
      "started": 310,
      "successRate": 91.18
    }
  }
}
```

#### Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Assignment exists but progress doc deleted | Counted as not started |
| User has `profileId = ""` (non-user role) | Falls back to `assignedToId` as `trackingId` |
| Zero assignments in range | `successRate: 0` |

---

### 4.3 `GET /api/kpi/content-popularity`

**Purpose:** Identifies the most-assigned and most-watched content items. Returns top-10 courses and shorts ranked independently by (a) assignment count and (b) unique watcher count.

**Required Role:** `admin`

#### Request

| Parameter | In | Type | Required |
|-----------|----|------|----------|
| `from` | query | ISO 8601 | No |
| `to` | query | ISO 8601 | No |

#### Business Logic (Step-by-Step)

1. Validate session → `role === "admin"`.
2. Run four parallel MongoDB aggregation pipelines:
   - `CourseAssignment` → group by `courseId`, count, sort desc, limit 10, `$lookup` into `courses`.
   - `ShortAssignment` → group by `shortVideoId`, count, sort desc, limit 10, `$lookup` into `short-videos`.
   - `LessonVideoProgress` → group by `courseId`, collect unique `userId` set + sum `watchedSeconds`, sort by set size desc, limit 10, `$lookup` into `courses`.
   - `ShortVideoProgress` → group by `shortVideoId`, collect unique `trackingId` set + sum `watchedSeconds`, sort by set size desc, limit 10, `$lookup` into `short-videos`.
3. Return all four ranked lists.

**Side Effects:** None.

#### Success Response `200`

```json
{
  "success": true,
  "message": "Content popularity fetched",
  "data": {
    "period": { "from": "...", "to": "..." },
    "courses": {
      "topByAssignments": [
        {
          "_id": "664abc123...",
          "assignedCount": 45,
          "title": "Advanced React",
          "status": "published",
          "accessLevel": "develop"
        }
      ],
      "topByWatchers": [
        {
          "_id": "664abc123...",
          "uniqueWatchers": 38,
          "totalWatchedSeconds": 142800,
          "title": "Advanced React"
        }
      ]
    },
    "shorts": {
      "topByAssignments": [ { ... } ],
      "topByWatchers": [ { ... } ]
    }
  }
}
```

#### Notes

- A content item with high `assignedCount` but low `uniqueWatchers` indicates low engagement ("assigned but not watched").
- `totalWatchedSeconds` is the raw sum — not deduplicated per user. Use it for total consumption volume, not per-user average.
- If a content item was deleted after assignment, `title` will be `undefined` (lookup returns no match). The `_id` is still present.

---

### 4.4 `GET /api/kpi/ticket-stats`

**Purpose:** Provides support ticket volume by status and type, plus resolution time distribution (avg / min / max) in hours.

**Required Role:** `admin`

#### Request

| Parameter | In | Type | Required |
|-----------|----|------|----------|
| `from` | query | ISO 8601 | No |
| `to` | query | ISO 8601 | No |

#### Business Logic (Step-by-Step)

1. Validate session → `role === "admin"`.
2. Run three parallel aggregations on `SupportTicket`:
   - Group by `currentStatus` → count per `pending` / `resolved`.
   - Group by `type` → count per type slug, sort desc.
   - For `resolved` tickets with non-null `resolvedAt`: compute `resolutionMs = resolvedAt - createdAt`, take avg / min / max.
3. Convert milliseconds to hours (2 decimal places).
4. Return assembled payload.

**Side Effects:** None.

#### Success Response `200`

```json
{
  "success": true,
  "message": "Ticket stats fetched",
  "data": {
    "period": { "from": "...", "to": "..." },
    "byStatus": [
      { "status": "pending", "count": 12 },
      { "status": "resolved", "count": 88 }
    ],
    "byType": [
      { "type": "technical-issue", "count": 34 },
      { "type": "billing", "count": 22 },
      { "type": "content-feedback", "count": 18 }
    ],
    "resolution": {
      "resolvedCount": 88,
      "avgHours": 4.25,
      "minHours": 0.17,
      "maxHours": 72.00
    }
  }
}
```

#### Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| No resolved tickets | `resolvedCount: 0`, all hours `0` |
| `resolvedAt` is null | Ticket excluded from resolution time calculation |
| No tickets in period | Empty arrays, zero counts |

---

### 4.5 `GET /api/kpi/account-tiers`

**Purpose:** Returns the current distribution of `role=user` accounts across `free`, `develop`, and `master` tiers, new registrations per tier within the date range, and a 6-month monthly trend.

**Required Role:** `admin`

#### Request

| Parameter | In | Type | Required |
|-----------|----|------|----------|
| `from` | query | ISO 8601 | No |
| `to` | query | ISO 8601 | No |

#### Business Logic (Step-by-Step)

1. Validate session → `role === "admin"`.
2. Access `mongoose.connection.db` directly (better-auth manages the `user` collection outside Mongoose models).
3. Run three parallel aggregations on the `user` collection:
   - **Snapshot:** all `role=user` docs grouped by `accountType` → count + percentage.
   - **New in period:** `role=user` AND `createdAt` in `[from, to]`, grouped by `accountType`.
   - **Monthly trend:** `role=user` AND `createdAt` in last 180 days, grouped by `{ year, month, accountType }`.
4. Compute `percentage = count / totalUsers * 100` for the snapshot.
5. Return all three views.

**Side Effects:** None.

#### Success Response `200`

```json
{
  "success": true,
  "message": "Account tiers fetched",
  "data": {
    "period": { "from": "...", "to": "..." },
    "currentSnapshot": [
      { "accountType": "free",    "count": 210, "percentage": 72.41 },
      { "accountType": "develop", "count": 55,  "percentage": 18.97 },
      { "accountType": "master",  "count": 25,  "percentage": 8.62  }
    ],
    "newInPeriod": [
      { "accountType": "free",    "newUsers": 18 },
      { "accountType": "develop", "newUsers": 4  }
    ],
    "monthlyTrend": [
      { "year": 2024, "month": 11, "accountType": "free",    "count": 22 },
      { "year": 2024, "month": 11, "accountType": "develop", "count": 5  },
      { "year": 2024, "month": 12, "accountType": "free",    "count": 30 }
    ]
  }
}
```

#### Notes

- `currentSnapshot` reflects the **live** state of all users — not scoped to `from/to`.
- `newInPeriod` and `monthlyTrend` are scoped to their respective time windows.
- `percentage` is based on total `role=user` count only — admin/trainer/trainee accounts are excluded.

---

## 5. Standardised Error Model

| HTTP Status | Code | Scenario |
|-------------|------|----------|
| `401` | `UNAUTHORIZED` | No session or expired session |
| `403` | `FORBIDDEN` | Authenticated but `role !== "admin"` |
| `500` | `INTERNAL_ERROR` | Unhandled exception — propagated to global error handler |

**Error Payload:**
```json
{
  "success": false,
  "message": "Forbidden"
}
```

---

## 6. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Aggregate data leakage | All endpoints return only counts/rates — no user IDs, emails, or PII in response |
| Unauthorised access | Hard `role === "admin"` check before any DB query — no data fetched before auth passes |
| Query injection via date params | Dates parsed via `new Date()` — MongoDB receives typed `Date` objects, not raw strings |
| Rate limiting | KPI endpoints are read-heavy aggregations; apply the global `readLimiter` middleware (or a dedicated `kpiLimiter: 30 req/min/IP`) to prevent aggregate query abuse |
| Large date ranges | No server-side cap on range width — consider rejecting ranges > 365 days at the controller level for production |

---

## 7. Performance Considerations

| Endpoint | Hotspot | Mitigation |
|----------|---------|-----------|
| `/assignment-success` | N parallel `exists()` calls (one per assignment) | For ranges > 30 days, replace with a single `$lookup` aggregation pipeline |
| `/content-popularity` | 4 parallel aggregations with `$addToSet` (unique watchers) | `$addToSet` is memory-bound; index on `userId`/`trackingId` + `courseId`/`shortVideoId` already exists |
| `/account-tiers` | Raw `user` collection access via native driver | `role` field should be indexed in the `user` collection (verify via `db.user.getIndexes()`) |
| All endpoints | No caching | For dashboards, cache responses in Redis with a 5-minute TTL keyed by `endpoint + from + to` |

---

## 8. Observability

Every KPI request should emit:

| Metric | Type | Tags |
|--------|------|------|
| `kpi.request.duration_ms` | Histogram | `endpoint`, `status_code` |
| `kpi.request.count` | Counter | `endpoint`, `admin_id` |

These can be instrumented via a response-time middleware. No audit log is written for KPI reads (read-only analytics — no state change).

---

## 9. Assumptions & Constraints

1. `LessonVideoProgress.completed` is set to `true` by the progress-tracking subsystem when a lesson reaches the completion threshold — KPI does not recompute this.
2. `ShortVideoProgress.completed` follows the same contract.
3. `CourseAssignment.createdAt` is the canonical timestamp for "when assigned" — no separate `assignedAt` field exists.
4. The `user` collection is managed by `better-auth` and accessed via `mongoose.connection.db` — it is not a Mongoose model; field names (`role`, `accountType`, `createdAt`) must match the better-auth schema configuration exactly.
5. All monetary/tier upgrade logic (e.g., free → develop promotion) is outside KPI scope — KPI only reads current state.
6. KPI endpoints have **no write path** — they must never modify any document.
