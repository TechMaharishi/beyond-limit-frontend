# Admin Management API — Production Documentation

## Table of Contents

1. [API Overview](#1-api-overview)
2. [RBAC Model](#2-rbac-model)
3. [Error Handling Model](#3-error-handling-model)
4. [Endpoint Specifications](#4-endpoint-specifications)
5. [Security Considerations](#5-security-considerations)
6. [Deprecation Notes](#6-deprecation-notes)

---

## 1. API Overview

| Property | Value |
|---|---|
| Domain | Platform administration — user lifecycle, role management, banning, and profile governance |
| Style | REST over HTTP/HTTPS |
| Base URL | `{BETTER_AUTH_URL}/api/admin` |
| Authentication | Session cookie via Better Auth. All endpoints require an active authenticated session. |
| Authorization | Permission-based via `auth.api.userHasPermission()` on every request |

---

## 2. RBAC Model

### Permissions Matrix

| Endpoint | Required Permission | admin | trainer | trainee | user |
|---|---|---|---|---|---|
| `POST /admin/create-user` | `user:create` | ✅ | ❌ | ❌ | ❌ |
| `GET /admin/list-user/all` | `user:list` | ✅ | ✅ | ✅ | ✅ |
| `GET /admin/list-user` *(deprecated)* | `user:list` | ✅ | ✅ | ✅ | ✅ |
| `POST /admin/set-user-role` | `user:update` | ✅ | ❌ | ❌ | ❌ |
| `POST /admin/reset-user-password` | `user:reset-password` | ✅ | ❌ | ❌ | ❌ |
| `POST /admin/ban-user` | `user:ban` | ✅ | ✅ | ❌ | ❌ |
| `POST /admin/unban-user` | `user:ban` | ✅ | ✅ | ❌ | ❌ |
| `POST /admin/delete-user` | `user:delete` | ✅ | ❌ | ❌ | ❌ |
| `POST /admin/delete-users` | `user:delete` | ✅ | ❌ | ❌ | ❌ |
| `POST /admin/update-user` | `user:update` | ✅ | ❌ | ❌ | ❌ |
| `GET /admin/profiles` | `profile:manage` | ✅ | ❌ | ❌ | ❌ |
| `POST /admin/profiles` | `profile:manage` | ✅ | ❌ | ❌ | ❌ |
| `PATCH /admin/profiles/:profileId` | `profile:manage` | ✅ | ❌ | ❌ | ❌ |
| `DELETE /admin/profiles/:profileId` | `profile:manage` | ✅ | ❌ | ❌ | ❌ |
| `GET /admin/user-profiles` | `profile:view` | ✅ | ✅ | ✅ | ✅ |

### Authorization Enforcement Order

1. **Authentication** — Session must be active. `401` if not.
2. **Permission check** — `auth.api.userHasPermission()`. `403` if insufficient.
3. **Input validation** — Field types, enum values, format checks. `400` on failure.
4. **Resource existence** — MongoDB lookup. `404` if not found.
5. **Business rule guards** — Role constraints, profile limits, deletion protection.

---

## 3. Error Handling Model

### Error Response

```json
{ "error": "Human-readable message" }
```

or for profile endpoints:

```json
{ "message": "Human-readable message" }
```

### HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Resource created |
| `400` | Validation failure / business rule violation |
| `401` | No active session |
| `403` | Authenticated but not authorized |
| `404` | Resource not found |
| `500` | Unhandled server error |

---

## 4. Endpoint Specifications

---

### POST /api/admin/create-user

**Purpose:** Create a new platform user with a specified role. Sends account credentials via email. Optionally subscribes to Mailchimp newsletter.

**Required permission:** `user:create` (admin only)

#### Request Body

```json
{
  "email": "john@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "role": "trainer",
  "accountType": "free",
  "phone": "+1234567890",
  "newsletter": false
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `email` | string | ✅ | Valid email |
| `password` | string | ✅ | Plain text — hashed by Better Auth |
| `name` | string | ✅ | — |
| `role` | string | ✅ | `admin` \| `trainer` \| `trainee` \| `user` |
| `accountType` | string | ❌ | `free` \| `develop` \| `master`. Default: `free` |
| `phone` | string | ❌ | — |
| `newsletter` | boolean | ❌ | Default: `false`. If `true` and email is valid, subscribes to Mailchimp with tag `mobile-application` |

#### Response `201`

```json
{
  "data": {
    "user": {
      "id": "abc123",
      "email": "john@example.com",
      "name": "John Doe",
      "role": "trainer",
      "accountType": "free",
      "phone": "+1234567890",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### Side Effects

- Sends account credentials email to the new user's address.
- If `newsletter: true`, subscribes to Mailchimp (fire-and-forget, non-blocking).

#### cURL

```bash
curl -X POST https://api.example.com/api/admin/create-user \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<session_token>" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!",
    "name": "John Doe",
    "role": "trainer",
    "accountType": "free",
    "newsletter": false
  }'
```

#### Error Cases

```json
// 400 — invalid role
{ "message": "Invalid role" }

// 403 — insufficient permission
{ "message": "Forbidden" }
```

---

### GET /api/admin/list-user/all

**Purpose:** Paginated, searchable, filterable user list with clinical assignment enrichment for `user`-role accounts.

**Required permission:** `user:list`

#### Query Parameters

| Parameter | Type | Default | Constraints |
|---|---|---|---|
| `role` | string | — | `admin` \| `trainer` \| `trainee` \| `user`. Omit for all roles. |
| `search` | string | — | Substring search value |
| `field` | string | `name` | `name` \| `email` — field to search against |
| `sortBy` | string | `createdAt` | `createdAt` \| `updatedAt` \| `name` \| `email` |
| `sortDirection` | string | `asc` | `asc` \| `desc` |
| `page` | integer | `1` | ≥ 1 |
| `limit` | integer | `10` | ≥ 1, max `100` |

#### Response `200`

```json
{
  "data": {
    "users": [
      {
        "id": "abc123",
        "name": "John Doe",
        "email": "john@example.com",
        "emailVerified": true,
        "role": "user",
        "banned": false,
        "phone": "+1234567890",
        "accountType": "free",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "traineeName": "Dr. Smith",
        "traineeEmail": "smith@clinic.com",
        "traineeId": "xyz789"
      }
    ],
    "meta": {
      "page": 1,
      "offset": 0,
      "limit": 10,
      "total": 42,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

> `traineeName`, `traineeEmail`, `traineeId` are populated only for `role: "user"` accounts from the `ClinicalAssignment` collection. All three are `null` for non-user roles.

#### cURL

```bash
curl -X GET "https://api.example.com/api/admin/list-user/all?role=user&search=john&field=name&sortBy=createdAt&sortDirection=desc&page=1&limit=10" \
  -H "Cookie: session=<session_token>"
```

#### Error Cases

```json
// 400 — invalid role filter
{ "error": "Invalid role" }

// 400 — invalid search field
{ "error": "Invalid search field" }

// 400 — invalid sort field
{ "error": "Invalid sort field" }

// 403 — insufficient permission
{ "error": "Not allowed to list users" }
```

---

### GET /api/admin/list-user *(deprecated)*

**Purpose:** Legacy user list. Returns flat structure without proper pagination metadata. **Do not use in new integrations.** Use `GET /admin/list-user/all` instead.

**Required permission:** `user:list`

**Difference from `/list-user/all`:** Returns `total` and `limit` at the top level instead of a `meta` object. No `totalPages`, `hasNext`, or `hasPrev`. `traineeName` only (no `traineeEmail` / `traineeId`).

#### Response `200`

```json
{
  "data": {
    "users": [
      {
        "id": "abc123",
        "name": "John Doe",
        "email": "john@example.com",
        "emailVerified": true,
        "role": "user",
        "banned": false,
        "phone": "+1234567890",
        "accountType": "free",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "traineeName": "Dr. Smith"
      }
    ],
    "total": 42,
    "limit": 10
  }
}
```

---

### POST /api/admin/set-user-role

**Purpose:** Change a user's platform role. Handles session cleanup and default profile creation as side effects.

**Required permission:** `user:update` (admin only)

#### Request Body

```json
{
  "userId": "abc123",
  "role": "trainer"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `userId` | string | ✅ | Valid MongoDB ObjectId |
| `role` | string | ✅ | `admin` \| `trainer` \| `trainee` \| `user` |

#### Response `200`

```json
{
  "data": {
    "user": {
      "id": "abc123",
      "role": "trainer"
    }
  }
}
```

If role is already the same:

```json
{
  "data": { "message": "Role unchanged" }
}
```

#### Side Effects

| Transition | Side Effect |
|---|---|
| Any role → `user` | Upserts a default profile (`name: "My Profile"`) for the user if none exists |
| `user` → any other role | Clears all active profile selections from that user's sessions |

#### cURL

```bash
curl -X POST https://api.example.com/api/admin/set-user-role \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<session_token>" \
  -d '{ "userId": "abc123", "role": "trainer" }'
```

#### Error Cases

```json
// 400 — invalid role
{ "error": "Invalid role. Must be one of: admin, trainer, trainee, user" }

// 400 — malformed userId
{ "error": "Invalid userId format" }

// 404 — user not found
{ "error": "User not found" }

// 403 — insufficient permission
{ "error": "Not allowed to set user role" }
```

---

### POST /api/admin/reset-user-password

**Purpose:** Forcibly set a new password for any user.

**Required permission:** `user:reset-password` (admin only)

#### Request Body

```json
{
  "userId": "abc123",
  "newPassword": "NewSecurePass456!"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `userId` | string | ✅ | — |
| `newPassword` | string | ✅ | Hashed by Better Auth |

#### Response `200`

```json
{
  "data": { "status": true }
}
```

#### cURL

```bash
curl -X POST https://api.example.com/api/admin/reset-user-password \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<session_token>" \
  -d '{ "userId": "abc123", "newPassword": "NewSecurePass456!" }'
```

#### Error Cases

```json
// 403 — insufficient permission
{ "error": "Not allowed to reset user password" }
```

---

### POST /api/admin/ban-user

**Purpose:** Ban a user, optionally with a reason and expiry duration.

**Required permission:** `user:ban` (admin, trainer)

#### Request Body

```json
{
  "userId": "abc123",
  "banReason": "Violated community guidelines",
  "banExpiresIn": "7d"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `userId` | string | ✅ | — |
| `banReason` | string | ❌ | — |
| `banExpiresIn` | string or number | ❌ | Duration string: `10s`, `5m`, `2h`, `7d`. Or milliseconds as number. Omit for permanent ban. |

**Duration format:** `{integer}{unit}` where unit is `s` (seconds), `m` (minutes), `h` (hours), `d` (days). Case-insensitive. Invalid formats are treated as permanent (no expiry).

#### Response `200`

```json
{
  "data": {
    "user": {
      "id": "abc123",
      "banned": true,
      "banReason": "Violated community guidelines",
      "banExpires": "2024-01-08T00:00:00.000Z"
    }
  }
}
```

#### cURL

```bash
# Temporary ban (7 days)
curl -X POST https://api.example.com/api/admin/ban-user \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<session_token>" \
  -d '{ "userId": "abc123", "banReason": "Violated guidelines", "banExpiresIn": "7d" }'

# Permanent ban
curl -X POST https://api.example.com/api/admin/ban-user \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<session_token>" \
  -d '{ "userId": "abc123", "banReason": "Fraud" }'
```

#### Error Cases

```json
// 403 — insufficient permission
{ "error": "Not allowed to ban users" }
```

---

### POST /api/admin/unban-user

**Purpose:** Remove a ban from a user.

**Required permission:** `user:ban` (admin, trainer)

#### Request Body

```json
{ "userId": "abc123" }
```

#### Response `200`

```json
{
  "data": {
    "user": {
      "id": "abc123",
      "banned": false
    }
  }
}
```

#### cURL

```bash
curl -X POST https://api.example.com/api/admin/unban-user \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<session_token>" \
  -d '{ "userId": "abc123" }'
```

---

### POST /api/admin/delete-user

**Purpose:** Permanently delete a single user account.

**Required permission:** `user:delete` (admin only)

> Better Auth's `beforeDelete` hook prevents deletion of any `admin`-role account or any ID listed in `adminUserIds` config.

#### Request Body

```json
{ "userId": "abc123" }
```

#### Response `200`

```json
{
  "data": { "success": true }
}
```

#### cURL

```bash
curl -X POST https://api.example.com/api/admin/delete-user \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<session_token>" \
  -d '{ "userId": "abc123" }'
```

#### Error Cases

```json
// 403 — insufficient permission
{ "error": "Not allowed to delete users" }
```

---

### POST /api/admin/delete-users

**Purpose:** Bulk delete up to 100 user accounts in a single request.

**Required permission:** `user:delete` (admin only)

#### Request Body

```json
{
  "userIds": ["abc123", "def456", "ghi789"]
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `userIds` | string[] | ✅ | Non-empty array. Duplicates are deduplicated. Max 100 unique IDs. |

#### Processing

- Duplicates are removed before processing.
- Deletions are processed in concurrent batches of 10 using `Promise.allSettled`.
- Partial success is allowed — failed deletions are reported individually.
- Better Auth `beforeDelete` hook still applies per-user (admin accounts protected).

#### Response `200`

```json
{
  "data": {
    "success": ["abc123", "def456"],
    "failed": [
      {
        "userId": "ghi789",
        "error": "Cannot delete admin account"
      }
    ]
  }
}
```

#### cURL

```bash
curl -X POST https://api.example.com/api/admin/delete-users \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<session_token>" \
  -d '{ "userIds": ["abc123", "def456", "ghi789"] }'
```

#### Error Cases

```json
// 400 — empty array
{ "error": "userIds array is required" }

// 400 — over limit
{ "error": "Too many userIds, max 100" }

// 403 — insufficient permission
{ "error": "Not allowed to delete users" }
```

---

### POST /api/admin/update-user

**Purpose:** Update arbitrary fields on a user account via Better Auth's admin update API.

**Required permission:** `user:update` (admin only)

#### Request Body

```json
{
  "userId": "abc123",
  "data": {
    "name": "Jane Doe",
    "phone": "+9876543210",
    "accountType": "develop"
  }
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `userId` | string | ✅ | — |
| `data` | object | ✅ | Any user fields supported by Better Auth `adminUpdateUser` |

#### Response `200`

```json
{
  "data": {
    "user": {
      "id": "abc123",
      "name": "Jane Doe",
      "phone": "+9876543210",
      "accountType": "develop",
      "updatedAt": "2024-06-01T00:00:00.000Z"
    }
  }
}
```

#### cURL

```bash
curl -X POST https://api.example.com/api/admin/update-user \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<session_token>" \
  -d '{ "userId": "abc123", "data": { "name": "Jane Doe", "accountType": "develop" } }'
```

---

### GET /api/admin/profiles

**Purpose:** List all profiles belonging to a specific `user`-role account. Admin-only operation.

**Required permission:** `profile:manage` (admin only)

> Only works for accounts with `role: "user"`. Attempting to query a trainer/admin account returns `400`.

#### Query Parameters

| Parameter | Type | Required | Constraints |
|---|---|---|---|
| `userId` | string | ✅ | Valid MongoDB ObjectId of a `user`-role account |

#### Response `200`

```json
{
  "data": [
    {
      "_id": "prof123",
      "userId": "abc123",
      "name": "My Profile",
      "avatar": "https://cdn.example.com/avatar.jpg",
      "isDefault": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

Profiles are ordered by `createdAt` ascending.

#### cURL

```bash
curl -X GET "https://api.example.com/api/admin/profiles?userId=abc123" \
  -H "Cookie: session=<session_token>"
```

#### Error Cases

```json
// 400 — missing userId
{ "message": "userId query param is required" }

// 400 — target is not a user-role account
{ "message": "Profiles can only be managed for accounts with role 'user'" }

// 400 — malformed userId
{ "message": "Invalid userId format" }

// 404 — user not found
{ "message": "User not found" }

// 403 — insufficient permission
{ "message": "Forbidden" }
```

---

### POST /api/admin/profiles

**Purpose:** Create a new profile for a `user`-role account. Maximum 5 profiles per user.

**Required permission:** `profile:manage` (admin only)

#### Request Body

```json
{
  "userId": "abc123",
  "name": "Work Profile",
  "avatar": "https://cdn.example.com/avatar.jpg"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `userId` | string | ✅ | Must be a `user`-role account |
| `name` | string | ✅ | Non-empty after trim |
| `avatar` | string | ❌ | URL string. Default: `""` |

**Business rule:** The first profile created for a user is automatically set as `isDefault: true`. The creation check and insert are executed inside a MongoDB transaction.

#### Response `201`

```json
{
  "data": {
    "_id": "prof456",
    "userId": "abc123",
    "name": "Work Profile",
    "avatar": "https://cdn.example.com/avatar.jpg",
    "isDefault": false,
    "createdAt": "2024-06-01T00:00:00.000Z",
    "updatedAt": "2024-06-01T00:00:00.000Z"
  }
}
```

#### cURL

```bash
curl -X POST https://api.example.com/api/admin/profiles \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<session_token>" \
  -d '{ "userId": "abc123", "name": "Work Profile", "avatar": "" }'
```

#### Error Cases

```json
// 400 — profile limit reached
{ "message": "Maximum 5 profiles allowed" }

// 400 — missing name
{ "message": "Profile name is required" }

// 400 — missing userId
{ "message": "userId is required" }
```

---

### PATCH /api/admin/profiles/:profileId

**Purpose:** Update a profile's `name` or `avatar`. Target user must have `role: "user"`.

**Required permission:** `profile:manage` (admin only)

#### Path Parameters

| Parameter | Type | Constraints |
|---|---|---|
| `profileId` | string | Valid MongoDB ObjectId of the profile |

#### Request Body

```json
{
  "name": "Updated Name",
  "avatar": "https://cdn.example.com/new-avatar.jpg"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | string | ❌ | Non-empty after trim. Ignored if empty or absent. |
| `avatar` | string | ❌ | Can be empty string to clear avatar. |

#### Response `200`

```json
{
  "data": {
    "_id": "prof123",
    "userId": "abc123",
    "name": "Updated Name",
    "avatar": "https://cdn.example.com/new-avatar.jpg",
    "isDefault": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-06-01T00:00:00.000Z"
  }
}
```

#### cURL

```bash
curl -X PATCH https://api.example.com/api/admin/profiles/prof123 \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<session_token>" \
  -d '{ "name": "Updated Name" }'
```

#### Error Cases

```json
// 404 — profile not found
{ "message": "Profile not found" }

// 400 — profile owner is not role 'user'
{ "message": "Profiles can only be managed for accounts with role 'user'" }
```

---

### DELETE /api/admin/profiles/:profileId

**Purpose:** Delete a profile. Clears the profile from all active sessions of the owner.

**Required permission:** `profile:manage` (admin only)

**Business rule:** If the profile owner has `role: "user"`, the last remaining profile cannot be deleted. Non-user-role owners (e.g. a trainer who somehow has profiles) have no minimum profile count enforced.

#### Path Parameters

| Parameter | Type | Constraints |
|---|---|---|
| `profileId` | string | Valid MongoDB ObjectId |

#### Response `200`

```json
{
  "data": { "deleted": true }
}
```

#### Side Effects

- `clearProfileFromAllSessions(userId, profileId)` is called after deletion — removes this profile from any active session that currently has it selected (fire-and-forget, errors logged but non-fatal).

#### cURL

```bash
curl -X DELETE https://api.example.com/api/admin/profiles/prof123 \
  -H "Cookie: session=<session_token>"
```

#### Error Cases

```json
// 404 — profile not found
{ "message": "Profile not found" }

// 400 — cannot delete last profile of a user-role account
{ "message": "Cannot delete the only profile" }
```

---

### GET /api/admin/user-profiles

**Purpose:** View profiles for a `user`-role account. Returns a limited field set (no internal fields). Intended for read-only views by non-admin staff.

**Required permission:** `profile:view` (admin, trainer, trainee, user)

**Difference from `GET /admin/profiles`:** Uses `profile:view` (not `profile:manage`), returns only `_id`, `name`, `avatar`, `isDefault`, `createdAt`.

#### Query Parameters

| Parameter | Type | Required |
|---|---|---|
| `userId` | string | ✅ |

#### Response `200`

```json
{
  "data": [
    {
      "_id": "prof123",
      "name": "My Profile",
      "avatar": "https://cdn.example.com/avatar.jpg",
      "isDefault": true,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### cURL

```bash
curl -X GET "https://api.example.com/api/admin/user-profiles?userId=abc123" \
  -H "Cookie: session=<session_token>"
```

---

## 5. Security Considerations

### Deletion Protection

Better Auth's `beforeDelete` hook blocks deletion of:
- Any account with `role: "admin"`
- Any account whose ID appears in the `adminUserIds` config list

This applies to both `POST /admin/delete-user` and each item in `POST /admin/delete-users`.

### Bulk Operation Safety

`POST /admin/delete-users`:
- Deduplicates IDs before processing to prevent redundant calls.
- Enforces a hard cap of 100 IDs per request.
- Uses `Promise.allSettled` with a concurrency window of 10 — prevents overwhelming the auth service while maintaining throughput.
- Partial failures are reported per-ID without aborting the batch.

### Ban Duration Parsing

`banExpiresIn` is parsed server-side via `parseDurationToMs()`. The regex `/^(\d+)([smhd])$/i` only accepts well-formed duration strings. Malformed strings (`"forever"`, `"abc"`, `""`) return `undefined`, which results in a permanent ban — they do not throw or return an error. Callers should validate client-side before sending.

### Profile Governance

- All profile management endpoints (`/admin/profiles`) call `assertTargetIsUserRole()` before any operation. This prevents admin/trainer accounts from having profiles created or modified through these routes.
- Profile deletion triggers session cleanup to immediately revoke any active session that had the deleted profile selected.

### Input Sanitization

- `userId` strings are validated as MongoDB ObjectIds before any DB query.
- Role values are validated against explicit allowlists before being passed to Better Auth.
- `name` strings are trimmed before storage. Empty strings after trim are rejected.

---

## 6. Deprecation Notes

### GET /api/admin/list-user

This endpoint is marked for removal. The route file contains the comment:

> `// We need to remove this API from mobile app.`

**Do not use in new features.** The response shape is inconsistent with the rest of the API (flat `total` and `limit` instead of a `meta` object, missing `hasPrev`/`hasNext`/`totalPages`). Migrate any consumers to `GET /admin/list-user/all`.
