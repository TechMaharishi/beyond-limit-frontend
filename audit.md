# Audit Log API — Production Documentation

**Domain:** Beyond Limits Learning Hub — Compliance & Observability  
**Architectural Style:** REST  
**Base URL:** `https://<host>/api`  
**API Version:** v1 (implicit)  
**Transport:** HTTPS only  
**Auth Scheme:** Session cookie (`better-auth`) + optional `Authorization: Bearer <token>`

---

## 1. Domain Context

The Audit Log subsystem provides immutable, time-ordered records of significant state changes across four governance domains. It is designed for:

- **Compliance** — who changed what, when, and from where
- **Incident investigation** — reconstructing event sequences after a security or data incident
- **Administrative oversight** — monitoring privileged operations

### 1.1 Audit Categories

| Category Key | Label | Covers |
|-------------|-------|--------|
| `auth` | Authentication & Security | Signups, password events, bans, role changes, account deletions |
| `admin` | Administrative & Organisation | User CRUD, bulk operations, account tier changes |
| `content` | Content Management | Course/short lifecycle (create → publish → delete), assignment events |
| `support` | Data Integrity & Support | Ticket resolution |

### 1.2 Design Principle: No High-Volume Events

The following events are **deliberately excluded** to prevent collection bloat:

| Excluded Event | Reason |
|---------------|--------|
| User login / logout | High volume, low signal — covered by session logs |
| Notification sent | Pure side-effect, no state change |
| Content viewed / progress updated | Extremely high volume — handled by progress collections |
| API health checks | Infrastructure noise |
| Failed permission checks (403s) | Use WAF/access logs for this |

---

## 2. Audit Log Schema

```
AuditLog {
  _id          : ObjectId          — auto-generated
  actorId      : String (required) — session user ID who performed the action
  actorRole    : String (required) — role at time of action
  actorEmail   : String (required) — email at time of action (immutable snapshot)
  category     : Enum[auth|admin|content|support] (required)
  action       : AuditAction (required) — see full list below
  targetId     : String (optional) — affected resource ID
  targetType   : String (optional) — "user" | "course" | "short" | "ticket"
  meta         : Object (optional) — small diff payload, keep lean (< 2 KB)
  ip           : String (optional) — client IP from req.ip
  createdAt    : Date              — write-once timestamp (no updatedAt)
}
```

**TTL:** Documents auto-delete after **90 days** via a MongoDB TTL index on `createdAt`.  
**Mutability:** Audit logs are never updated or soft-deleted. Only the TTL process removes them.

### 2.1 Complete Action Inventory

| Category | Action | Trigger |
|----------|--------|---------|
| `auth` | `signup` | New user self-registration |
| `auth` | `email_verified` | Email OTP verification completed |
| `auth` | `password_changed` | Authenticated password change |
| `auth` | `password_reset` | Password reset via OTP flow |
| `auth` | `account_deleted` | User deletes own account |
| `auth` | `role_changed` | Admin changes a user's role |
| `auth` | `user_banned` | Admin bans a user |
| `auth` | `user_unbanned` | Admin unbans a user |
| `admin` | `user_created` | Admin creates a user account |
| `admin` | `user_updated` | Admin updates user profile |
| `admin` | `user_deleted` | Admin deletes a user |
| `admin` | `bulk_users_deleted` | Admin bulk-deletes users |
| `admin` | `account_type_changed` | Admin changes user's accountType tier |
| `content` | `course_created` | Course document created |
| `content` | `course_updated` | Course metadata updated |
| `content` | `course_published` | Course status → published |
| `content` | `course_rejected` | Course status → rejected |
| `content` | `course_deleted` | Course permanently deleted |
| `content` | `short_created` | Short video created |
| `content` | `short_updated` | Short video metadata updated |
| `content` | `short_published` | Short status → published |
| `content` | `short_rejected` | Short status → rejected |
| `content` | `short_deleted` | Short permanently deleted |
| `content` | `course_assigned` | Course assigned to a user/trainee |
| `content` | `course_unassigned` | Course assignment removed |
| `content` | `short_assigned` | Short assigned to a user/trainee |
| `content` | `short_unassigned` | Short assignment removed |
| `support` | `ticket_resolved` | Support ticket marked resolved |

---

## 3. RBAC Model

### 3.1 Role Hierarchy

```
admin  ← exclusive read access to all audit endpoints
  └── trainer  ← no access
  └── trainee  ← no access
  └── user     ← no access
```

Audit data is **never exposed to non-admin roles** — even partial views. The rationale: audit logs contain actor emails, IP addresses, and operational details that must remain admin-confidential.

### 3.2 Permissions Matrix

| Endpoint | admin | trainer | trainee | user |
|----------|:-----:|:-------:|:-------:|:----:|
| GET /audit/logs | ✅ | ❌ | ❌ | ❌ |
| GET /audit/summary | ✅ | ❌ | ❌ | ❌ |

### 3.3 Enforcement Logic

**Stage 1 — Authentication:**  
`auth.api.getSession()` is called. Missing or expired session → `401`.

**Stage 2 — Authorization:**  
`user.role === "admin"` is checked. Any other role → `403`.

**Stage 3 — No write path via API:**  
Audit logs are written exclusively by the `writeAuditLog()` server-side helper. There is no public endpoint to create, update, or delete audit entries.

---

## 4. `writeAuditLog()` — Internal Write Interface

This is not an HTTP endpoint. It is a fire-and-forget server-side function called from other controllers.

### Signature

```typescript
writeAuditLog(entry: {
  actorId:    string;
  actorRole:  string;
  actorEmail: string;
  category:   "auth" | "admin" | "content" | "support";
  action:     AuditAction;
  targetId?:  string;
  targetType?: string;
  meta?:      Record<string, unknown>;
  ip?:        string;
}): void
```

### Behaviour

- Calls `AuditLog.create(entry)` wrapped in `.catch(() => {})`.
- **Never throws** — a failed audit write must not break the primary request.
- **Never awaited** — logged asynchronously, zero latency impact on caller.

### Usage Example

```typescript
import { writeAuditLog } from "@/models/audit-log";

// Inside a controller, after successful role change:
writeAuditLog({
  actorId:    String((user as any).id),
  actorRole:  String((user as any).role),
  actorEmail: String((user as any).email),
  category:   "auth",
  action:     "role_changed",
  targetId:   targetUserId,
  targetType: "user",
  meta:       { from: "trainee", to: "trainer" },
  ip:         req.ip,
});
```

### meta Payload Guidelines

| Action | Recommended meta fields |
|--------|------------------------|
| `role_changed` | `{ from: oldRole, to: newRole }` |
| `account_type_changed` | `{ from: oldType, to: newType }` |
| `course_rejected` | `{ reason: rejectReason }` |
| `bulk_users_deleted` | `{ count: deletedCount }` |
| `ticket_resolved` | `{ resolutionMsg: "..." }` |
| `user_banned` | `{ reason: banReason }` |

**Keep meta lean** — do not store full document snapshots. Store only the changed fields or a short summary. Target < 500 bytes per entry.

---

## 5. Endpoint Specifications

---

### 5.1 `GET /api/audit/logs`

**Purpose:** Paginated, filterable list of audit log entries. Supports narrowing by category, action, actor, target, and time range.

**Required Role:** `admin`

#### Request Query Parameters

| Parameter | Type | Required | Constraints | Description |
|-----------|------|----------|-------------|-------------|
| `category` | string | No | Enum: `auth\|admin\|content\|support` | Filter by audit category |
| `action` | string | No | Any valid `AuditAction` value | Filter by specific action |
| `actorId` | string | No | Non-empty string | Filter logs by the user who performed the action |
| `targetId` | string | No | Non-empty string | Filter logs affecting a specific resource |
| `from` | ISO 8601 string | No | Valid date | Start of time window (default: no lower bound) |
| `to` | ISO 8601 string | No | Valid date | End of time window (default: no upper bound) |
| `page` | integer | No | ≥ 1, default: 1 | Page number |
| `limit` | integer | No | 1–100, default: 20 | Records per page |

#### Validation Rules

- `category` must be one of the four valid enum values. Invalid value → `400 Bad Request`.
- `from` and `to` are parsed via `new Date()`. Invalid date strings produce `Invalid Date` — MongoDB will ignore malformed `$gte`/`$lte` values (no results returned). Strictly speaking, the controller should validate this — treat as a known improvement.
- Filters are **ANDed** — all specified filters must match simultaneously.

#### Business Logic (Step-by-Step)

1. Validate session → `role === "admin"`.
2. Validate `category` if provided.
3. Build MongoDB filter object from query params.
4. Build `createdAt` range object if `from` or `to` provided.
5. Execute `AuditLog.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit)` in parallel with `AuditLog.countDocuments(filter)`.
6. Return paginated response with `meta`.

**Side Effects:** None — read-only.  
**Idempotency:** Fully idempotent.

#### Success Response `200`

```json
{
  "success": true,
  "message": "Audit logs fetched",
  "data": [
    {
      "_id": "6641a2c3f4e5b6a7c8d9e001",
      "actorId": "user_abc123",
      "actorRole": "admin",
      "actorEmail": "admin@example.com",
      "category": "auth",
      "action": "role_changed",
      "targetId": "user_xyz789",
      "targetType": "user",
      "meta": { "from": "trainee", "to": "trainer" },
      "ip": "203.0.113.42",
      "createdAt": "2025-05-01T14:32:11.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "offset": 0,
    "total": 142,
    "hasNext": true
  }
}
```

#### Error Responses

| HTTP | Scenario | Response message |
|------|----------|-----------------|
| `401` | No session | `"Unauthorized"` |
| `403` | Not admin | `"Forbidden"` |
| `400` | Invalid `category` value | `"Invalid category. Valid values: auth, admin, content, support"` |
| `500` | DB error | Generic server error |

#### Example Requests

**Filter by category + date range:**
```
GET /api/audit/logs?category=admin&from=2025-04-01T00:00:00Z&to=2025-04-30T23:59:59Z&limit=50
```

**Find all actions by a specific admin:**
```
GET /api/audit/logs?actorId=user_abc123&page=2&limit=20
```

**Find all events affecting a specific course:**
```
GET /api/audit/logs?targetId=664abc123def&category=content
```

---

### 5.2 `GET /api/audit/summary`

**Purpose:** Returns aggregate counts per category and the top 5 most frequent actions over the last 30 days. Used for dashboard widgets and quick health checks.

**Required Role:** `admin`

#### Request

No query parameters. The time window is **fixed at last 30 days** and is not configurable via query params.

#### Business Logic (Step-by-Step)

1. Validate session → `role === "admin"`.
2. Compute `since = now - 30 days`.
3. Run two parallel aggregations on `AuditLog`:
   - Group by `category`, count — scoped to `createdAt >= since`.
   - Group by `action`, count, sort desc, limit 5 — scoped to `createdAt >= since`.
4. Merge category counts with the full `VALID_CATEGORIES` list so categories with zero events appear with `count: 0`.
5. Return assembled payload.

**Side Effects:** None.

#### Success Response `200`

```json
{
  "success": true,
  "message": "Audit summary fetched",
  "data": {
    "period": "last_30_days",
    "categoryBreakdown": [
      { "category": "auth",    "label": "Authentication & Security",        "count": 48 },
      { "category": "admin",   "label": "Administrative & Organisation",    "count": 23 },
      { "category": "content", "label": "Content Management",              "count": 91 },
      { "category": "support", "label": "Data Integrity & Support",        "count": 12 }
    ],
    "topActions": [
      { "action": "short_assigned",   "count": 67 },
      { "action": "course_assigned",  "count": 34 },
      { "action": "course_published", "count": 18 },
      { "action": "role_changed",     "count": 9  },
      { "action": "user_banned",      "count": 4  }
    ]
  }
}
```

#### Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Category has no events in period | Appears in `categoryBreakdown` with `count: 0` |
| Fewer than 5 distinct actions | Returns however many exist (< 5 items) |
| Audit collection is empty | All counts `0`, `topActions: []` |

---

## 6. Standardised Error Model

| HTTP Status | Scenario |
|-------------|----------|
| `401` | Missing or expired session |
| `403` | Role is not `admin` |
| `400` | Invalid `category` enum value in `/audit/logs` |
| `500` | Unhandled exception (DB timeout, aggregation error) |

**Error Payload Structure:**
```json
{
  "success": false,
  "message": "<description>"
}
```

---

## 7. Pagination Model

Applies to `GET /audit/logs`.

| Field | Description |
|-------|-------------|
| `page` | Current page (1-indexed) |
| `limit` | Records returned in this page |
| `offset` | Records skipped (`(page-1) * limit`) |
| `total` | Total matching records across all pages |
| `hasNext` | `true` if more pages exist |

Default `limit` is **20** (conservative — audit log rows can be wide).  
Maximum `limit` is **100** (enforced server-side).

---

## 8. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| PII in audit logs | `actorEmail` and `ip` are stored — treat the collection as sensitive. Restrict DB-level read access to admin service account only. |
| Tampering | Audit logs have no update or delete API endpoint. TTL-only deletion. Application-level writes are via `writeAuditLog()` which only creates. |
| Log injection | `meta` is stored as `Mixed` (BSON) — no string interpolation. MongoDB treats it as structured data, not executable. |
| Enumeration via `actorId` | Only admins can query — `actorId` filter is intentional for investigation. |
| Rate limiting | Apply `readLimiter` middleware. Aggregation queries on large collections are expensive — recommend `20 req/min/IP` for audit endpoints. |
| IP spoofing | `req.ip` relies on correct `trust proxy` Express setting. Ensure this is configured if behind a load balancer. |

---

## 9. Performance Considerations

| Endpoint | Hotspot | Mitigation |
|----------|---------|-----------|
| `GET /audit/logs` | Full collection scan without filters | Indexes on `createdAt`, `category`, `actorId` cover the primary query patterns |
| `GET /audit/summary` | Two aggregations over last 30 days | 30-day window keeps the working set small; `{ createdAt: -1 }` index makes this efficient |
| Both | Unbounded `total` count on large collections | `countDocuments` with a selective filter is fast with the composite index; avoid querying without `createdAt` bounds |

**Index Coverage (defined in model):**

```
{ createdAt: -1 }                         — time-range queries and default sort
{ actorId: 1, createdAt: -1 }             — actor investigation queries
{ category: 1, createdAt: -1 }            — category-filtered listing
{ createdAt: 1 } (TTL, expireAfterSeconds: 7776000)  — auto-expiry
```

**Caching:** Audit logs must **not** be cached at the application layer — responses must always reflect the live collection state for compliance accuracy.

---

## 10. Observability

| Metric | Type | Tags |
|--------|------|------|
| `audit.write.success` | Counter | `category`, `action` |
| `audit.write.failure` | Counter | `category`, `action` |
| `audit.read.duration_ms` | Histogram | `endpoint` |

`writeAuditLog` failures are silent (`.catch(() => {})`). For production, replace the silent catch with a structured log to stderr so failures are visible in log aggregation (e.g., CloudWatch, Datadog) without breaking request flow.

---

## 11. Assumptions & Constraints

1. **Write path is server-internal only.** There is no HTTP endpoint to create audit entries. All writes originate from `writeAuditLog()` called within controllers after successful state mutations.
2. **Audit write failures are non-fatal.** If MongoDB is unavailable at write time, the primary operation (e.g., role change) still succeeds and the audit entry is lost. This is an acceptable trade-off for availability.
3. **90-day retention** is enforced via MongoDB TTL index. No manual archival pipeline exists. If longer retention is required, export to cold storage (S3/GCS) before the TTL window closes.
4. **`actorEmail` is snapshotted at write time.** If the user later changes their email, historical logs still reflect the email at the time of the action.
5. **`ip` accuracy** depends on `app.set("trust proxy", 1)` being configured when the app runs behind a reverse proxy or load balancer.
6. **No audit events are emitted by the audit read endpoints themselves** — reading audit logs does not generate new audit entries (would create infinite recursion).
7. **`meta` has no enforced schema** — it is free-form BSON. Callers are responsible for keeping payloads lean (< 500 bytes recommended, hard limit is MongoDB document size of 16 MB).
8. The `writeAuditLog()` function must be **manually called** from each controller where auditing is required — it is not auto-instrumented via middleware. Controllers that do not call it will produce no audit trail for their actions.
