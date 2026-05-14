# Short Videos API — Production Documentation

## Table of Contents

1. [API Overview](#1-api-overview)
2. [RBAC Model](#2-rbac-model)
3. [Error Handling Model](#3-error-handling-model)
4. [Pagination, Filtering & Sorting](#4-pagination-filtering--sorting)
5. [V1 Upload Flow](#5-v1-upload-flow)
6. [Legacy Endpoints](#6-legacy-endpoints)
7. [Security Considerations](#7-security-considerations)
8. [Performance & Observability](#8-performance--observability)
9. [Deprecation Notes](#9-deprecation-notes)

---

## 1. API Overview

| Property | Value |
|---|---|
| Domain | Short-form video content — creation, upload, management, progress tracking |
| Style | REST over HTTP/HTTPS |
| Versioning | Path-based. V1 (`/api/v1/short-videos`) handles the signed upload flow. Legacy (`/api/short-videos`) handles management and viewing. |
| Base URL | `{BETTER_AUTH_URL}/api` |
| Authentication | Session cookie via Better Auth. All endpoints require an active session. |
| Media Hosting | Cloudinary (video + thumbnails + resources). V1 uploads go directly from client to Cloudinary via signed URL. |

### Two Upload Paths

| Path | Route | When to use |
|---|---|---|
| **V1 (recommended)** | `POST /v1/short-videos` → sign → upload → webhook → publish | New integrations. Client uploads directly to Cloudinary. Backend never handles the video binary. |
| **Legacy (deprecated)** | `POST /short-videos` | Old integrations only. Client sends Cloudinary metadata after uploading externally. Do not use in new features. |

---

## 2. RBAC Model

### Permissions Matrix

| Endpoint | Required Permission | admin | trainer | trainee | user |
|---|---|---|---|---|---|
| `POST /v1/short-videos` | `shortVideo:create` | ✅ | ✅ | ✅ | ❌ |
| `POST /v1/short-videos/:id/signed-upload-url` | owner or admin | ✅ | ✅ own | ✅ own | ❌ |
| `GET /v1/short-videos/:id/status` | owner or admin | ✅ | ✅ own | ✅ own | ❌ |
| `POST /v1/short-videos/:id/publish` | owner or admin | ✅ | ✅ own | ✅ own | ❌ |
| `POST /v1/short-videos/:id/thumbnail` | `shortVideo:update` | ✅ | ✅ own | ✅ own | ❌ |
| `GET /short-videos` | `shortVideoStatus:view` | ✅ | ✅ | ✅ | ❌ |
| `GET /short-videos/published-videos` | `shortVideo:view` | ✅ | ✅ | ✅ | ✅ |
| `GET /short-videos/:id` | `shortVideo:view` | ✅ | ✅ | ✅ | ✅ with gates |
| `GET /short-videos/:id/progress` | session only | ✅ | ✅ | ✅ | ✅ |
| `POST /short-videos/:id/progress` | session only | ✅ | ✅ | ✅ | ✅ |
| `PUT /short-videos/:id` | `shortVideo:update` | ✅ | ✅ own | ✅ own | ❌ |
| `DELETE /short-videos/:id` | `shortVideo:delete` | ✅ | ✅ own | ✅ own | ❌ |
| `DELETE /short-videos/:id/video` | `shortVideo:update` | ✅ | ✅ own | ✅ own | ❌ |
| `PUT /admin/change-status-short-video/:id` | role check only | ✅ all statuses | ✅ draft/pending own | ✅ draft/pending own | ❌ |
| `POST /short-videos/:id/resources` | `shortVideo:update` | ✅ | ✅ own | ✅ own | ❌ |
| `DELETE /short-videos/:id/resources/:resourceId` | `shortVideo:update` | ✅ | ✅ own | ✅ own | ❌ |
| `POST /short-videos/:id/retry-subtitles` | session only | ✅ | ✅ own | ✅ own | ❌ |
| `POST /short-videos/:id/thumbnail` | `shortVideo:update` | ✅ | ✅ own | ✅ own | ❌ |

### Visibility Gates (read endpoints)

| Role | Visible `visibility` values |
|---|---|
| admin / trainer / trainee | `clinicians`, `users`, `all` |
| user | `users`, `all` only — `clinicians` is blocked |

### Access Level Gates (user role only)

| User `accountType` | Accessible `accessLevel` values |
|---|---|
| `free` | `free` |
| `develop` | `free`, `develop` |
| `master` | `free`, `develop`, `master` |

Clinicians (admin / trainer / trainee) bypass `accessLevel` gating.

### Progress Tracking Identity

- `user` role: tracking ID is the session `activeProfileId`. If no profile is active, progress endpoints return `400`.
- All other roles: tracking ID is the user's own account ID.

---

## 3. Error Handling Model

### Success Envelope

```json
{
  "success": true,
  "message": "Human-readable description",
  "data": { ... },
  "pagination": { ... }
}
```

### Error Envelope

```json
{
  "success": false,
  "message": "Human-readable description",
  "data": null
}
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

## 4. Pagination, Filtering & Sorting

Applies to `GET /short-videos` and `GET /short-videos/published-videos`.

### Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer ≥ 1 | `1` | Page number |
| `limit` | integer ≥ 1 | `10` | Items per page |
| `q` | string | — | Case-insensitive text search on `title` and `description`. Input is regex-escaped before use. |
| `tags` / `tag` | string or comma-separated | — | Filter by tag slugs. Unknown slugs return `400`. |
| `sortBy` / `by` | `createdAt` \| `title` \| `tags` | `createdAt` | Sort field |
| `order` / `sort` | `asc` \| `desc` | `desc` | Sort direction |
| `status` | `draft` \| `pending` \| `published` \| `rejected` | — | Status filter (management list only) |

### Pagination Envelope

```json
{
  "pagination": {
    "page": 1,
    "offset": 0,
    "limit": 10,
    "total": 42,
    "hasNext": true
  }
}
```

---

## 5. V1 Upload Flow

### Flow Diagram

```
Client                        Backend                         Cloudinary
  |                              |                                 |
  | POST /v1/short-videos        |                                 |
  |----------------------------->|                                 |
  | 201 { _id, status:"draft" }  |                                 |
  |<-----------------------------|                                 |
  |                              |                                 |
  | POST /v1/short-videos/:id    |                                 |
  |   /signed-upload-url         |                                 |
  |----------------------------->|                                 |
  | 200 { uploadUrl, fields }    |                                 |
  |<-----------------------------|                                 |
  |                              |                                 |
  | PUT uploadUrl (multipart)    |                                 |
  |--------------------------------------------------------->|    |
  | { secure_url, public_id, duration }                      |    |
  |<---------------------------------------------------------|    |
  |                              |                                 |
  |                              | POST /api/v1/webhooks/          |
  |                              |   cloudinary/upload-complete    |
  |                              |<--------------------------------|
  |                              | verify HMAC, update DB          |
  |                              | subtitle job enqueued           |
  |                              |                                 |
  | GET /v1/short-videos/:id     |                                 |
  |   /status (poll)             |                                 |
  |----------------------------->|                                 |
  | 200 { videoReady: true }     |                                 |
  |<-----------------------------|                                 |
  |                              |                                 |
  | POST /v1/short-videos/:id    |                                 |
  |   /publish                   |                                 |
  |----------------------------->|                                 |
  | 200 { status:"published" }   |                                 |
  |<-----------------------------|                                 |
```

---

### POST /api/v1/short-videos

**Purpose:** Create a video shell (metadata only, no media). Status is always `draft`.

**Required permission:** `shortVideo:create` (admin, trainer, trainee)

#### Request Body

```json
{
  "title": "Mastering Patient Empathy",
  "description": "A 5-minute guide on clinical empathy techniques.",
  "tags": ["clinical", "soft-skills"],
  "accessLevel": "free",
  "visibility": "clinicians"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | string | ✅ | Non-empty after trim |
| `description` | string | ✅ | Non-empty after trim |
| `tags` | string or string[] | ❌ | Comma-separated or array. Resolved against active tag slugs in DB. Unknown slugs return `400`. |
| `accessLevel` | string | ❌ | `free` (default) \| `develop` \| `master` |
| `visibility` | string | ❌ | `users` (default) \| `clinicians` \| `all` |

#### Response `201`

```json
{
  "success": true,
  "message": "Short video shell created",
  "data": {
    "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "title": "Mastering Patient Empathy",
    "description": "A 5-minute guide on clinical empathy techniques.",
    "tags": ["clinical", "soft-skills"],
    "status": "draft",
    "accessLevel": "free",
    "visibility": "clinicians",
    "videoReady": false,
    "createdAt": "2024-06-01T10:00:00.000Z"
  }
}
```

#### cURL

```bash
curl -X POST https://api.example.com/api/v1/short-videos \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{
    "title": "Mastering Patient Empathy",
    "description": "A 5-minute guide on clinical empathy techniques.",
    "tags": ["clinical", "soft-skills"],
    "visibility": "clinicians"
  }'
```

#### Error Cases

```json
// 400 — missing title or description
{ "success": false, "message": "title and description are required", "data": null }

// 400 — invalid tags
{ "success": false, "message": "Invalid tags: provide existing tag slugs", "data": null }

// 403 — insufficient permission
{ "success": false, "message": "Forbidden: insufficient permissions", "data": null }
```

---

### POST /api/v1/short-videos/:id/signed-upload-url

**Purpose:** Generate Cloudinary signed upload credentials for the client to upload the video file directly to Cloudinary.

**Access:** Admin or course owner only. No `userHasPermission` check — ownership enforced manually.

**Constraint:** Cannot be called on a `published` video (re-upload blocked).

#### Response `200`

```json
{
  "success": true,
  "message": "Signed upload URL generated",
  "data": {
    "uploadUrl": "https://api.cloudinary.com/v1_1/{cloudName}/video/upload",
    "fields": {
      "api_key": "123456789012345",
      "timestamp": 1717228800,
      "signature": "a1b2c3d4e5f6...",
      "public_id": "short-videos/65f1a2b3c4d5e6f7a8b9c0d1/1717228800",
      "notification_url": "https://api.example.com/api/v1/webhooks/cloudinary/upload-complete",
      "resource_type": "video"
    }
  }
}
```

**Signed parameters:** `notification_url`, `public_id`, `timestamp`. HMAC-SHA1 via Cloudinary SDK.

**Client upload:** `multipart/form-data` POST to `uploadUrl` with all `fields` as form fields plus the video file under any field name.

```bash
# Step 1 — get signed fields
curl -X POST https://api.example.com/api/v1/short-videos/65f1a2b3c4d5e6f7a8b9c0d1/signed-upload-url \
  -H "Cookie: better-auth.session_token=<token>"

# Step 2 — upload directly to Cloudinary (client-side)
curl -X POST "https://api.cloudinary.com/v1_1/{cloudName}/video/upload" \
  -F "api_key=123456789012345" \
  -F "timestamp=1717228800" \
  -F "signature=a1b2c3d4e5f6..." \
  -F "public_id=short-videos/65f1a2b3c4d5e6f7a8b9c0d1/1717228800" \
  -F "notification_url=https://api.example.com/api/v1/webhooks/cloudinary/upload-complete" \
  -F "resource_type=video" \
  -F "file=@/path/to/video.mp4"
```

#### Error Cases

```json
// 400 — video is published
{ "success": false, "message": "Cannot replace video on a published short", "data": null }

// 400 — invalid video ID
{ "success": false, "message": "Invalid video ID", "data": null }

// 403 — not owner or admin
{ "success": false, "message": "Forbidden", "data": null }

// 404 — video not found
{ "success": false, "message": "Short video not found", "data": null }

// 500 — missing env vars
{ "success": false, "message": "Server configuration error", "data": null }
```

---

### GET /api/v1/short-videos/:id/status

**Purpose:** Poll for upload completion. The Cloudinary webhook fires asynchronously after upload — this endpoint tells the client when the DB has been updated.

**Access:** Admin or video owner only.

#### Response `200`

```json
{
  "success": true,
  "message": "Status fetched",
  "data": {
    "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "status": "draft",
    "videoReady": true,
    "durationSeconds": 312,
    "subtitleStatus": "pending"
  }
}
```

| Field | Description |
|---|---|
| `videoReady` | `true` when `cloudinaryId` is populated (webhook has fired and DB updated) |
| `subtitleStatus` | `pending` \| `done` \| `failed` \| `null` |

#### cURL

```bash
curl -X GET https://api.example.com/api/v1/short-videos/65f1a2b3c4d5e6f7a8b9c0d1/status \
  -H "Cookie: better-auth.session_token=<token>"
```

---

### POST /api/v1/short-videos/:id/publish

**Purpose:** Move a video from `draft` to `published`. Validates all required fields. Auto-generates thumbnail if one has not been uploaded.

**Access:** Admin or video owner only.

**Preconditions (all must pass):**
1. `cloudinaryId` must be populated (video uploaded)
2. `title` and `description` must be non-empty
3. At least one tag must exist
4. Status must not already be `published`

**Side effect:** If `thumbnailUrl` is empty and `cloudinaryId` exists, a thumbnail is auto-generated from the first second of the video before saving.

#### Response `200`

```json
{
  "success": true,
  "message": "Short video published",
  "data": {
    "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "title": "Mastering Patient Empathy",
    "status": "published",
    "cloudinaryUrl": "https://res.cloudinary.com/.../short-videos/.../manifest.m3u8",
    "thumbnailUrl": "https://res.cloudinary.com/.../short-videos/....jpg",
    "durationSeconds": 312,
    "updatedAt": "2024-06-01T11:00:00.000Z"
  }
}
```

> `cloudinaryUrl` in the response is the HLS streaming URL (`format: m3u8`, `streaming_profile: auto`), not the raw upload URL.

#### cURL

```bash
curl -X POST https://api.example.com/api/v1/short-videos/65f1a2b3c4d5e6f7a8b9c0d1/publish \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Error Cases

```json
// 400 — already published
{ "success": false, "message": "Short video is already published", "data": null }

// 400 — video not uploaded yet
{ "success": false, "message": "Video file not yet uploaded. Upload the video before publishing.", "data": null }

// 400 — missing title/description
{ "success": false, "message": "title and description are required before publishing", "data": null }

// 400 — missing tags
{ "success": false, "message": "At least one tag is required before publishing", "data": null }
```

---

### POST /api/v1/short-videos/:id/thumbnail (V1)

Same behavior as `POST /short-videos/:id/thumbnail` below. See [Upload Thumbnail](#post-apishort-videosidthumbnail).

---

## 6. Legacy Endpoints

---

### POST /api/short-videos *(deprecated)*

**Purpose:** Create a short video with metadata and optional Cloudinary details in a single request.

> **This endpoint is deprecated.** The route file comment reads: `// This api is old method to create short videos should be removed.` Do not use in new integrations. Use the V1 flow instead.

**Required permission:** `shortVideo:create`

#### Request Body

```json
{
  "title": "Short Video Title",
  "description": "Description here.",
  "tags": ["clinical"],
  "accessLevel": "free",
  "status": "pending",
  "visibility": "users",
  "cloudinaryUrl": "https://res.cloudinary.com/...",
  "cloudinaryId": "short-videos/abc123",
  "thumbnailUrl": "https://res.cloudinary.com/...thumb.jpg",
  "durationSeconds": 180,
  "resources": []
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | string | Conditional | Required if `status` ≠ `draft` |
| `description` | string | Conditional | Required if `status` ≠ `draft` |
| `tags` | string or string[] | Conditional | Required if `status` ≠ `draft`. Max 10. |
| `cloudinaryUrl` | string | Conditional | Required if `status` ≠ `draft` |
| `cloudinaryId` | string | Conditional | Required if `status` ≠ `draft`. Verified against Cloudinary API. |
| `status` | string | ❌ | `draft` (default) \| `pending` \| `published`. Only admin can set `published`. |
| `accessLevel` | string | ❌ | `free` \| `develop` \| `master`. Default: `free` |
| `visibility` | string | ❌ | `users` (default) \| `clinicians` \| `all` |
| `thumbnailUrl` | string | ❌ | Auto-generated from video if omitted and `cloudinaryId` provided |
| `durationSeconds` | number | ❌ | Falls back to Cloudinary resource `duration` if omitted |
| `resources` | array | ❌ | Max 10. Each item: `{ name, url, fileType?, cloudinaryPublicId? }` |

#### Response `201`

Full `ShortVideo` Mongoose document.

#### Side Effects

Pushes FCM/Expo notification to all admin users and creates in-app `Notification` records (fire-and-forget, non-blocking).

---

### GET /api/short-videos

**Purpose:** Management-facing list. Shows videos scoped by role.

**Required permission:** `shortVideoStatus:view` (admin, trainer, trainee — not user)

**Role-based scope:**

| Role | Visible videos |
|---|---|
| admin | Own drafts + all pending/published/rejected |
| trainer / trainee | All their own videos (any status) |

#### Query Parameters

See [Section 4](#4-pagination-filtering--sorting). `status` filter is valid here.

#### Response `200`

```json
{
  "success": true,
  "message": "Short videos fetched",
  "data": [
    {
      "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
      "title": "Mastering Patient Empathy",
      "description": "A 5-minute guide on clinical empathy techniques.",
      "tags": ["clinical", "soft-skills"],
      "status": "published",
      "thumbnailUrl": "https://res.cloudinary.com/...jpg",
      "cloudinaryId": "short-videos/65f.../1717228800",
      "accessLevel": "free",
      "visibility": "clinicians",
      "durationSeconds": 312,
      "createdAt": "2024-06-01T10:00:00.000Z",
      "updatedAt": "2024-06-01T11:00:00.000Z",
      "createdBy": {
        "_id": "abc123",
        "name": "Dr. Jane Smith",
        "email": "jane@clinic.com"
      },
      "videoReady": true
    }
  ],
  "pagination": { "page": 1, "offset": 0, "limit": 10, "total": 5, "hasNext": false }
}
```

> `videoReady` is derived server-side: `true` when `cloudinaryId` is non-empty.

#### cURL

```bash
curl -X GET "https://api.example.com/api/short-videos?status=pending&page=1&limit=10" \
  -H "Cookie: better-auth.session_token=<token>"
```

---

### GET /api/short-videos/published-videos

**Purpose:** Consumer-facing list. Published videos only, visibility-filtered by role. Includes per-video progress for the requesting user.

**Required permission:** `shortVideo:view` (all roles)

#### Response `200`

```json
{
  "success": true,
  "message": "Published short videos fetched",
  "data": [
    {
      "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
      "title": "Mastering Patient Empathy",
      "description": "A 5-minute guide.",
      "tags": ["clinical"],
      "status": "published",
      "thumbnailUrl": "https://res.cloudinary.com/...jpg",
      "accessLevel": "free",
      "visibility": "clinicians",
      "durationSeconds": 312,
      "createdAt": "2024-06-01T10:00:00.000Z",
      "updatedAt": "2024-06-01T11:00:00.000Z",
      "createdBy": {
        "_id": "abc123",
        "name": "Dr. Jane Smith",
        "email": "jane@clinic.com"
      },
      "progress": {
        "watchedSeconds": 150,
        "completed": false,
        "percentWatched": 48.08,
        "durationSeconds": 312
      }
    }
  ],
  "pagination": { "page": 1, "offset": 0, "limit": 10, "total": 24, "hasNext": true }
}
```

> `progress` values are `0` / `false` for videos the user has never watched. Progress is fetched in a single batch query — not N+1.

#### cURL

```bash
curl -X GET "https://api.example.com/api/short-videos/published-videos?page=1&limit=10&tags=clinical" \
  -H "Cookie: better-auth.session_token=<token>"
```

---

### GET /api/short-videos/:id

**Purpose:** Fetch full video document for a specific video. Applies visibility and access level gates for `user` role.

**Required permission:** `shortVideo:view` (all roles)

**Access rules:**

- Admin and video owner: unrestricted.
- Non-owner clinicians (trainer/trainee): must be `published`. Any visibility allowed. No `accessLevel` gate.
- `user` role: must be `published`. `visibility` must not be `clinicians`. `accessLevel` must match `accountType`.

**Side effect:** `cloudinaryUrl` in the response is replaced with the HLS streaming URL on the fly. The DB value is not modified.

#### Response `200`

```json
{
  "success": true,
  "message": "Short video fetched",
  "data": {
    "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "title": "Mastering Patient Empathy",
    "description": "A 5-minute guide on clinical empathy techniques.",
    "tags": ["clinical", "soft-skills"],
    "status": "published",
    "cloudinaryUrl": "https://res.cloudinary.com/.../manifest.m3u8",
    "cloudinaryId": "short-videos/65f.../1717228800",
    "thumbnailUrl": "https://res.cloudinary.com/...jpg",
    "accessLevel": "free",
    "visibility": "clinicians",
    "durationSeconds": 312,
    "subtitles": [...],
    "subtitle_status": "done",
    "resources": [
      {
        "_id": "res123",
        "name": "Reference Guide.pdf",
        "url": "https://res.cloudinary.com/.../guide.pdf",
        "fileType": "application/pdf",
        "cloudinaryPublicId": "short-videos/65f.../resources/guide"
      }
    ],
    "user": "abc123",
    "createdBy": { "_id": "abc123", "name": "Dr. Jane Smith", "email": "jane@clinic.com" },
    "createdAt": "2024-06-01T10:00:00.000Z",
    "updatedAt": "2024-06-01T11:00:00.000Z"
  }
}
```

#### cURL

```bash
curl -X GET https://api.example.com/api/short-videos/65f1a2b3c4d5e6f7a8b9c0d1 \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Error Cases

```json
// 403 — user role, visibility is clinicians
{ "success": false, "message": "Forbidden: this content is for clinicians only", "data": null }

// 403 — user role, accountType too low
{ "success": false, "message": "Forbidden: upgrade your account to access this content", "data": null }

// 403 — video not published and requester is not admin/owner
{ "success": false, "message": "Forbidden: video not accessible", "data": null }
```

---

### PUT /api/short-videos/:id

**Purpose:** Update video metadata and optionally replace the Cloudinary video asset reference.

**Required permission:** `shortVideo:update` (admin, trainer, trainee)

**Ownership:** Admin or video owner only.

#### Request Body (all fields optional)

```json
{
  "title": "Updated Title",
  "description": "Updated description.",
  "tags": ["clinical", "updated-tag"],
  "accessLevel": "develop",
  "status": "pending",
  "visibility": "all",
  "cloudinaryUrl": "https://res.cloudinary.com/...",
  "cloudinaryId": "short-videos/65f.../new_timestamp",
  "thumbnailUrl": "https://res.cloudinary.com/...new-thumb.jpg",
  "durationSeconds": 200
}
```

| Field | Type | Constraints |
|---|---|---|
| `title` | string | — |
| `description` | string | — |
| `tags` | string or string[] | Max 10. Resolved against active slugs. |
| `accessLevel` | string | `free` \| `develop` \| `master` |
| `status` | string | `draft`/`pending`/`published`/`rejected`. Only admin can set `published` or `rejected`. |
| `visibility` | string | `clinicians` \| `users` \| `all` |
| `cloudinaryId` | string | If changed: verified against Cloudinary API. Old asset destroyed. Subtitle pipeline reset. `not_before` set 2 min ahead. |
| `thumbnailUrl` | string | If omitted and `cloudinaryId` provided: auto-generated from new video. |
| `durationSeconds` | number | Falls back to Cloudinary resource `duration` if `cloudinaryId` provided but `durationSeconds` omitted. |

#### Response `200`

Full updated `ShortVideo` document.

#### cURL

```bash
curl -X PUT https://api.example.com/api/short-videos/65f1a2b3c4d5e6f7a8b9c0d1 \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{
    "title": "Updated Title",
    "status": "pending"
  }'
```

---

### DELETE /api/short-videos/:id

**Purpose:** Hard-delete a video record and destroy all associated Cloudinary assets.

**Required permission:** `shortVideo:delete` (admin, trainer, trainee)

**Ownership:** Admin or video owner only.

**Side effects:**
- Main video asset destroyed in Cloudinary (errors suppressed).
- All resources with a `cloudinaryPublicId` destroyed in Cloudinary (errors suppressed).

#### Response `200`

```json
{
  "success": true,
  "message": "Short video deleted",
  "data": { "id": "65f1a2b3c4d5e6f7a8b9c0d1" }
}
```

#### cURL

```bash
curl -X DELETE https://api.example.com/api/short-videos/65f1a2b3c4d5e6f7a8b9c0d1 \
  -H "Cookie: better-auth.session_token=<token>"
```

---

### DELETE /api/short-videos/:id/video

**Purpose:** Remove the video file from Cloudinary and clear all media fields, without deleting the video record itself. Resets the subtitle pipeline.

**Required permission:** `shortVideo:update`

**Ownership:** Admin or video owner only.

**Side effects:**
- Cloudinary asset destroyed (errors suppressed).
- `cloudinaryUrl`, `cloudinaryId`, `thumbnailUrl`, `durationSeconds` set to empty/0.
- `subtitles`, `subtitle_status`, `subtitle_failure_reason`, `subtitle_retry_count`, `retryable`, `last_subtitle_attempt` reset.
- All `ShortVideoProgress` documents for this video deleted.

#### Response `200`

```json
{
  "success": true,
  "message": "Short video file deleted",
  "data": {
    "id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "title": "Mastering Patient Empathy",
    "description": "A 5-minute guide.",
    "status": "draft",
    "tags": ["clinical"],
    "cloudinaryUrl": "",
    "cloudinaryId": "",
    "thumbnailUrl": "",
    "durationSeconds": 0
  }
}
```

#### cURL

```bash
curl -X DELETE https://api.example.com/api/short-videos/65f1a2b3c4d5e6f7a8b9c0d1/video \
  -H "Cookie: better-auth.session_token=<token>"
```

---

### PUT /admin/change-status-short-video/:id

**Purpose:** Update the lifecycle status of a short video.

**Access:** Role check only (no `userHasPermission` call). Admin, trainer, trainee only. `user` role returns `403`.

**Status transition rules:**

| Role | Allowed target statuses | Ownership required |
|---|---|---|
| admin | `published`, `rejected`, `draft` | No (any video) |
| trainer / trainee | `draft`, `pending` | Yes (own videos only) |

**Business rules:**
- `status: "rejected"` requires a non-empty `rejectReason`.
- Trainer/trainee cannot submit for `pending` if `cloudinaryId` is empty.
- Setting to `published` or `draft` clears `rejectReason`.
- Setting the same status it already has returns `400` (except `rejected` which always re-applies).

#### Request Body

```json
{
  "status": "rejected",
  "rejectReason": "Audio quality is too low."
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `status` | string | ✅ | Enum — see table above |
| `rejectReason` | string | Conditional | Required and non-empty when `status: "rejected"` |

#### Response `200`

```json
{
  "success": true,
  "message": "Short video status updated",
  "data": {
    "id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "title": "Mastering Patient Empathy",
    "description": "A 5-minute guide.",
    "status": "rejected",
    "rejectReason": "Audio quality is too low.",
    "tags": ["clinical"],
    "cloudinaryUrl": "https://res.cloudinary.com/...",
    "accessLevel": "free",
    "durationSeconds": 312,
    "createdAt": "2024-06-01T10:00:00.000Z",
    "updatedAt": "2024-06-01T12:00:00.000Z",
    "user": "abc123"
  }
}
```

**Side effects:** When admin sets status to `published` or `rejected`, a push notification (FCM/Expo) and in-app `Notification` record are sent to the video owner.

#### cURL

```bash
# Admin rejecting a video
curl -X PUT https://api.example.com/api/admin/change-status-short-video/65f1a2b3c4d5e6f7a8b9c0d1 \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{ "status": "rejected", "rejectReason": "Audio quality is too low." }'

# Creator submitting for review
curl -X PUT https://api.example.com/api/admin/change-status-short-video/65f1a2b3c4d5e6f7a8b9c0d1 \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{ "status": "pending" }'
```

#### Error Cases

```json
// 400 — already in that status
{ "success": false, "message": "Video is already in requested status", "data": null }

// 400 — rejectReason missing
{ "success": false, "message": "rejectReason is required when status is 'rejected'", "data": null }

// 400 — pending without video
{ "success": false, "message": "Upload a video before submitting for review", "data": null }

// 403 — creator trying to publish/reject
{ "success": false, "message": "You can only set status to 'draft' or 'pending'", "data": null }

// 403 — creator trying to change someone else's video
{ "success": false, "message": "Forbidden: you can only change the status of your own videos", "data": null }
```

---

### POST /api/short-videos/:id/resources

**Purpose:** Add supplementary resources (files or URL references) to a video. Max 10 total.

**Required permission:** `shortVideo:update`

**Ownership:** Admin or video owner only.

**Content-Type:** `multipart/form-data`

#### Form Fields

| Field | Type | Description |
|---|---|---|
| `files` | file[] | Up to 10 files. Uploaded to Cloudinary as `resource_type: raw` under `short-videos/{id}/resources/`. |
| `names` | JSON string or array | Optional display names for uploaded files. Index-matched to `files`. Falls back to `originalname`. |
| `resources` | JSON string or array | URL-based resources. Each: `{ name, url, fileType?, cloudinaryPublicId? }`. |

Both `files` and `resources` can be combined in a single request. The total across existing + new must not exceed 10.

#### Response `201`

```json
{
  "success": true,
  "message": "2 resource(s) added",
  "data": [
    {
      "_id": "res123",
      "name": "Reference Guide.pdf",
      "url": "https://res.cloudinary.com/.../guide.pdf",
      "fileType": "application/pdf",
      "cloudinaryPublicId": "short-videos/65f.../resources/guide"
    },
    {
      "_id": "res124",
      "name": "Supplementary Reading",
      "url": "https://external.example.com/doc.pdf",
      "fileType": "",
      "cloudinaryPublicId": ""
    }
  ]
}
```

#### cURL

```bash
# File upload
curl -X POST https://api.example.com/api/short-videos/65f1a2b3c4d5e6f7a8b9c0d1/resources \
  -H "Cookie: better-auth.session_token=<token>" \
  -F "files=@/path/to/guide.pdf" \
  -F 'names=["Reference Guide.pdf"]'

# URL reference
curl -X POST https://api.example.com/api/short-videos/65f1a2b3c4d5e6f7a8b9c0d1/resources \
  -H "Cookie: better-auth.session_token=<token>" \
  -F 'resources=[{"name":"Supplementary Reading","url":"https://external.example.com/doc.pdf"}]'
```

#### Error Cases

```json
// 400 — no files or resources
{ "success": false, "message": "Provide at least one file or resource url", "data": null }

// 400 — exceeds limit
{ "success": false, "message": "Adding 3 resource(s) would exceed the maximum of 10", "data": null }
```

---

### DELETE /api/short-videos/:id/resources/:resourceId

**Purpose:** Remove a single resource by its MongoDB `_id`. Destroys the Cloudinary asset if `cloudinaryPublicId` exists.

**Required permission:** `shortVideo:update`

**Ownership:** Admin or video owner only.

#### Response `200`

```json
{
  "success": true,
  "message": "Resource removed",
  "data": { "resourceId": "res123" }
}
```

#### cURL

```bash
curl -X DELETE https://api.example.com/api/short-videos/65f1a2b3c4d5e6f7a8b9c0d1/resources/res123 \
  -H "Cookie: better-auth.session_token=<token>"
```

---

### POST /api/short-videos/:id/progress

**Purpose:** Record watch progress for a video. Idempotent — only increases `watchedSeconds`, never decreases.

**Authentication:** Session required. No permission check.

**Progress identity:** `user` role uses `session.activeProfileId`. All other roles use the user's own account ID. If `user` role has no active profile, returns `400`.

**Completion threshold:** `percentWatched ≥ 90%` OR `watchedSeconds ≥ durationSeconds`.

**`watchedSeconds` cap:** Capped at `durationSeconds` before storing. Cannot exceed video length.

#### Request Body

```json
{ "watchedSeconds": 280 }
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `watchedSeconds` | number | ✅ | ≥ 0 |

#### Response `200`

```json
{
  "success": true,
  "message": "Short video progress updated",
  "data": {
    "watchedSeconds": 280,
    "completed": false,
    "percentWatched": 89.74,
    "durationSeconds": 312
  }
}
```

#### cURL

```bash
curl -X POST https://api.example.com/api/short-videos/65f1a2b3c4d5e6f7a8b9c0d1/progress \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{ "watchedSeconds": 280 }'
```

#### Error Cases

```json
// 400 — invalid watchedSeconds
{ "success": false, "message": "Invalid watchedSeconds", "data": null }

// 400 — user role with no active profile
{ "success": false, "message": "No active profile selected. Select a profile before tracking progress.", "data": null }
```

---

### GET /api/short-videos/:id/progress

**Purpose:** Fetch current watch progress for the requesting user on a specific video.

**Authentication:** Session required. No permission check.

#### Response `200`

```json
{
  "success": true,
  "message": "Short video progress fetched",
  "data": {
    "watchedSeconds": 280,
    "completed": false,
    "percentWatched": 89.74,
    "durationSeconds": 312,
    "createdBy": {
      "_id": "abc123",
      "name": "Dr. Jane Smith",
      "email": "jane@clinic.com"
    }
  }
}
```

> Returns `watchedSeconds: 0`, `completed: false`, `percentWatched: 0` if the user has no progress record for this video.

#### cURL

```bash
curl -X GET https://api.example.com/api/short-videos/65f1a2b3c4d5e6f7a8b9c0d1/progress \
  -H "Cookie: better-auth.session_token=<token>"
```

---

### POST /api/short-videos/:id/thumbnail

**Purpose:** Upload a custom thumbnail image. Replaces the existing thumbnail (same Cloudinary public ID `thumb_{id}` with `overwrite: true`). CDN cache invalidated automatically.

**Required permission:** `shortVideo:update`

**Ownership:** Admin or video owner only.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Constraints |
|---|---|---|---|
| `thumbnail` | image file | ✅ | Max 5 MB. Uploaded to `short-video-thumbnails/thumb_{id}`. |

#### Response `200`

```json
{
  "success": true,
  "message": "Thumbnail uploaded",
  "data": {
    "id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "thumbnailUrl": "https://res.cloudinary.com/.../short-video-thumbnails/thumb_65f1a2b3c4d5e6f7a8b9c0d1.jpg"
  }
}
```

> Because `overwrite: true` is set, Cloudinary replaces the existing asset at the same public ID. No previous thumbnail deletion call is needed. `invalidate: true` ensures the CDN edge cache is purged.

#### cURL

```bash
curl -X POST https://api.example.com/api/short-videos/65f1a2b3c4d5e6f7a8b9c0d1/thumbnail \
  -H "Cookie: better-auth.session_token=<token>" \
  -F "thumbnail=@/path/to/thumbnail.jpg"
```

#### Error Cases

```json
// 400 — no file provided
{ "success": false, "message": "Thumbnail image is required", "data": null }

// 400 — file too large
{ "success": false, "message": "Thumbnail size exceeds 5 MB", "data": null }
```

---

### POST /api/short-videos/:id/retry-subtitles

**Purpose:** Re-queue failed subtitle generation jobs for a video.

Handled by the `retryCaptions` controller. Authentication required. Admin or owner only (enforced in that controller).

---

## 7. Security Considerations

- **Rate limiting:** `writeLimiter` applied to all POST, PUT, DELETE routes. GET routes have no rate limit.
- **Signed upload security:** Cloudinary signatures use HMAC-SHA1 with a timestamp. The `public_id` encodes `short-videos/{videoId}/{timestamp}` — each upload gets a unique path, preventing replay attacks.
- **Webhook integrity:** The upload-complete webhook verifies `x-cld-signature` + `x-cld-timestamp` headers via `cloudinary.utils.verifyNotificationSignature` using the raw request body before any DB writes.
- **Input sanitization:** All text search values are escaped via `escapeRegex()` before use in MongoDB `$regex` queries, preventing ReDoS.
- **MongoDB injection:** All ID parameters validated via `isValidObjectId()` before queries.
- **Cloudinary verification:** `POST /short-videos` (legacy) verifies the submitted `cloudinaryId` exists in Cloudinary via `cloudinary.api.resource()` before creating the record.
- **Least privilege:** Only admin can set `published` or `rejected` status. Trainers/trainees can only control their own videos and only to `draft`/`pending`.

---

## 8. Performance & Observability

### Progress Tracking Idempotency

`trackShortVideoProgress` uses `$max` in `findOneAndUpdate` — only updates if the new `watchedSeconds` is greater than the stored value. This makes repeated calls from a video player safe and idempotent without application-level deduplication.

### Batch Progress Fetch

`listPublishedShortVideos` fetches all progress records for the current page of videos in a single `ShortVideoProgress.find({ trackingId, shortVideoId: { $in: videoIds } })` query — not one per video.

### HLS Streaming

`cloudinaryUrl` returned in read endpoints is always the HLS URL (`format: m3u8`, `streaming_profile: auto`). This shifts adaptive bitrate streaming to Cloudinary's CDN, reducing server bandwidth to zero for video delivery.

### Subtitle Pipeline

On video upload (via webhook) or `cloudinaryId` change (via update), the subtitle pipeline is reset: `subtitle_status: "pending"`, `not_before: now + 2 minutes`. The 2-minute delay allows Cloudinary to finish transcoding before the caption worker fires.

### Observability

Structured log entries via `logger`:
- `[ShortVideosV1] Shell created: {id} by user {userId}`
- `[ShortVideosV1] Published: {id} by user {userId}`
- `[ShortVideoNotification] Error sending notification: ...`

---

## 9. Deprecation Notes

### POST /api/short-videos (legacy create)

Route comment: `// This api is old method to create short videos should be removed.`

This endpoint predates the V1 signed upload flow. It requires the client to upload to Cloudinary externally and then pass the resulting `cloudinaryId` to the backend — which the backend then verifies by calling `cloudinary.api.resource()`. This is redundant and slower than the V1 flow.

**Migration path:** Use `POST /v1/short-videos` → `POST /v1/short-videos/:id/signed-upload-url` → upload → poll `GET /v1/short-videos/:id/status` → `POST /v1/short-videos/:id/publish`.
