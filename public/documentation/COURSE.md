# Course Videos API — Production Documentation

## Table of Contents

1. [API Overview](#1-api-overview)
2. [RBAC Model](#2-rbac-model)
3. [Response Envelope](#3-response-envelope)
4. [Pagination, Filtering & Sorting](#4-pagination-filtering--sorting)
5. [Endpoint Specifications](#5-endpoint-specifications)
   - [POST /courses](#post-apicourses)
   - [GET /courses](#get-apicourses)
   - [GET /courses/published-videos](#get-apicoursespublished-videos)
   - [GET /courses/completed](#get-apicoursescompleted)
   - [GET /courses/saved-course](#get-apicoursessaved-course)
   - [GET /courses/:id](#get-apicoursesid)
   - [PATCH /courses/:id](#patch-apicoursesid)
   - [DELETE /courses/:id](#delete-apicoursesid)
   - [DELETE /courses/:id/thumbnail](#delete-apicoursesidthumbnail)
   - [GET /courses/:id/progress](#get-apicoursesidprogress)
   - [POST /courses/:id/save](#post-apicoursesidsave)
   - [POST /courses/:id/resources/upload](#post-apicoursesidresourcesupload)
   - [DELETE /courses/:id/resources/:resourceIndex](#delete-apicoursesidresourcesresourceindex)
   - [POST /courses/:courseId/chapters](#post-apicoursescourseidchapters)
   - [DELETE /courses/:courseId/chapters/:chapterIndex](#delete-apicoursescourseidchapterschapterindex)
   - [POST /courses/:courseId/chapters/:chapterIndex/lessons](#post-apicoursescourseidchapterschapterindexlessons)
   - [DELETE /courses/:courseId/chapters/:chapterIndex/lessons/:lessonIndex](#delete-apicoursescourseidchapterschapterindexlessonslessonindex)
   - [POST /courses/:courseId/chapters/:chapterIndex/quizzes](#post-apicoursescourseidchapterschapterindexquizzes)
   - [DELETE /courses/:courseId/chapters/:chapterIndex/quizzes/:quizIndex](#delete-apicoursescourseidchapterschapterindexquizzesquizindex)
   - [PATCH /courses/:courseId/chapters/:chapterIndex/lessons/:lessonIndex/video](#patch-apicoursescourseidchapterschapterindexlessonslessonindexvideo)
   - [DELETE /courses/:courseId/chapters/:chapterIndex/lessons/:lessonIndex/videos/:videoIndex](#delete-apicoursescourseidchapterschapterindexlessonslessonindexvideosvideoindex)
   - [PUT /courses/:courseId/chapters/:chapterId/lessons/progress](#put-apicoursescourseidchapterscapterdidlessonsprogress)
   - [POST /courses/:courseId/chapters/:chapterId/quiz/responses](#post-apicoursescourseidchapterscapterdidquizresponses)
   - [PUT /admin/change-status-course/:id](#put-apiadminchange-status-courseid)
   - [POST /courses/videos-upload](#post-apicoursesvideosupload)
   - [POST /courses/delete-cloudinary-video](#post-apicoursesdelete-cloudinary-video)
   - [POST /courses/:courseId/retry-subtitles](#post-apicoursescourseidretry-subtitles)
6. [V1 Signed Upload Flow](#6-v1-signed-upload-flow)
7. [Security Considerations](#7-security-considerations)
8. [Performance & Observability](#8-performance--observability)

---

## 1. API Overview

| Property | Value |
|---|---|
| Domain | Course content management — structured courses with chapters, lessons, quizzes, and videos |
| Style | REST over HTTP/HTTPS |
| Base URL | `{BASE_URL}/api` |
| Authentication | Session cookie managed by Better Auth. All endpoints require an active session. |
| Media Hosting | Cloudinary (video + images). Direct upload via signed URL in V1 flow. |
| Rate Limiting | All mutating routes (POST/PATCH/PUT/DELETE) protected by `writeLimiter` middleware. |

### Architectural Notes

- Courses are top-level documents containing embedded `chapters → lessons → videos + quizzes`.
- Aggregate stats (`totalDurationSeconds`, `totalQuizzes`, `totalChapters`) are recomputed synchronously on every mutating operation via `recomputeCourseStats`.
  - `totalDurationSeconds` = sum of all video `durationSeconds` + (`totalQuizzes` × 30 seconds).
- Subtitle generation is asynchronous: on video upload, a `CourseSubtitleJob` is enqueued (with a 2-minute delay) and picked up by a background worker.
- Course status lifecycle: `draft` → `pending` → `published` | `rejected`.
- Two upload paths exist for lesson videos:
  - **Legacy** (`PATCH /courses/:courseId/chapters/:chapterIndex/lessons/:lessonIndex/video`): client provides Cloudinary metadata after uploading externally.
  - **V1** (`POST /api/v1/courses/.../signed-upload-url`): backend issues a signed URL; client uploads directly to Cloudinary; webhook fires to persist metadata.
- Each chapter supports exactly **one lesson** and **one quiz**.

---

## 2. RBAC Model

### Role Definitions

| Role | Description |
|---|---|
| `admin` | Full platform access. Approves/rejects courses, sees all content regardless of visibility or status. |
| `trainer` | Content creator. Creates and manages their own courses. Can view all published content. |
| `trainee` | Clinical learner. Consumes all published content. Can save/bookmark courses. |
| `user` | General public learner. Subject to `visibility:all` and `accessLevel` gating on reads. Blocked from management list. |

### Access Level Hierarchy (user role only)

| User `accountType` | Accessible Course `accessLevel` values |
|---|---|
| `free` (default) | `free` only |
| `develop` | `free`, `develop` |
| `master` | `free`, `develop`, `master` |

Clinicians (admin / trainer / trainee) bypass `accessLevel` and `visibility` gating entirely.

### Permissions Matrix

| Endpoint | admin | trainer | trainee | user |
|---|---|---|---|---|
| `POST /courses` | ✅ | ✅ | ❌ | ❌ |
| `GET /courses` | ✅ own drafts + pending + published | ✅ own all statuses + all published | ✅ published only | ❌ |
| `GET /courses/published-videos` | ✅ all visibility | ✅ all visibility | ✅ all visibility | ✅ `visibility:all` only |
| `GET /courses/completed` | ✅ | ✅ | ✅ | ✅ |
| `GET /courses/saved-course` | ✅ | ✅ | ✅ | ✅ |
| `GET /courses/:id` | ✅ | ✅ | ✅ | ✅ if `visibility:all` + `accessLevel` match + published |
| `PATCH /courses/:id` | ✅ | ✅ own only | ❌ | ❌ |
| `DELETE /courses/:id` | ✅ | ✅ own only | ❌ | ❌ |
| `DELETE /courses/:id/thumbnail` | ✅ | ✅ own only | ❌ | ❌ |
| `GET /courses/:id/progress` | ✅ | ✅ | ✅ | ✅ |
| `POST /courses/:id/save` | ✅ | ✅ | ✅ | ✅ |
| `POST /courses/:id/resources/upload` | ✅ | ✅ own only | ❌ | ❌ |
| `DELETE /courses/:id/resources/:idx` | ✅ | ✅ own only | ❌ | ❌ |
| `POST /courses/:courseId/chapters` | ✅ | ✅ own only | ❌ | ❌ |
| `DELETE /courses/:courseId/chapters/:cIdx` | ✅ | ✅ own only | ❌ | ❌ |
| `POST .../chapters/:cIdx/lessons` | ✅ | ✅ own only | ❌ | ❌ |
| `DELETE .../chapters/:cIdx/lessons/:lIdx` | ✅ | ✅ own only | ❌ | ❌ |
| `POST .../chapters/:cIdx/quizzes` | ✅ | ✅ own only | ❌ | ❌ |
| `DELETE .../chapters/:cIdx/quizzes/:qIdx` | ✅ | ✅ own only | ❌ | ❌ |
| `PATCH .../lessons/:lIdx/video` (legacy) | ✅ | ✅ own only | ❌ | ❌ |
| `DELETE .../videos/:vIdx` | ✅ | ✅ own only | ❌ | ❌ |
| `PUT .../lessons/progress` | ✅ | ✅ | ✅ | ✅ |
| `POST .../quiz/responses` | ✅ | ✅ | ✅ | ✅ |
| `PUT /admin/change-status-course/:id` | ✅ all statuses | ✅ `draft`/`pending` | ✅ `draft`/`pending` | ❌ |
| `POST /courses/videos-upload` | ✅ | ✅ | ❌ | ❌ |
| `POST /courses/delete-cloudinary-video` | ✅ | ✅ | ❌ | ❌ |
| `POST /courses/:courseId/retry-subtitles` | ✅ | ✅ | ❌ | ❌ |

### Authorization Enforcement Order

For every request:

1. **Authentication** — `auth.api.getSession()`. Returns `401` if no active session.
2. **Permission check** — `auth.api.userHasPermission()`. Returns `403` if the role lacks the required permission.
3. **Resource existence** — MongoDB lookup. Returns `404` if not found.
4. **Ownership check** — `course.user.toString() === user.id`. Returns `403` if neither admin nor owner (for write operations).
5. **Visibility check** — For `user` role reads: course `visibility` must be `"all"`.
6. **Access level check** — For `user` role reads: user `accountType` must permit course `accessLevel`.
7. **Status check** — For non-clinician, non-owner reads: `course.status` must be `"published"`.

---

## 3. Response Envelope

### Success

```json
{
  "success": true,
  "message": "Human-readable description",
  "data": { ... },
  "pagination": { "page": 1, "offset": 0, "limit": 10, "total": 42, "hasNext": true }
}
```

`pagination` is only present on list endpoints.

### Error

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
| `200` | Succeeded |
| `201` | Resource created |
| `400` | Validation failure / bad input |
| `401` | No valid session |
| `403` | Authenticated but not authorized |
| `404` | Resource not found |
| `500` | Unhandled server error / Cloudinary failure |

---

## 4. Pagination, Filtering & Sorting

Applies to: `GET /courses`, `GET /courses/published-videos`, `GET /courses/completed`, `GET /courses/saved-course`.

### Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer ≥ 1 | `1` | Page number |
| `limit` | integer ≥ 1 | `10` | Items per page |
| `q` | string | — | Case-insensitive text search on `title` and `description` |
| `tags` / `tag` | string or comma-separated | — | Filter by tag slugs. Unknown slugs return `400`. |
| `sortBy` / `by` | `createdAt` \| `title` \| `tags` | `createdAt` | Sort field |
| `order` / `sort` | `asc` \| `desc` \| `dsc` | `desc` | Sort direction |
| `status` | `draft` \| `pending` \| `published` \| `rejected` | — | Status filter (`GET /courses` only) |

### Pagination Response

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

> `GET /courses/completed` and `GET /courses/saved-course` perform in-memory pagination after fetching all matching documents. The `total` reflects the filtered count (completed or saved), not all published courses.

---

## 5. Endpoint Specifications

---

### POST /api/courses

**Purpose:** Create a new course.

**Permission:** `course:create` (admin, trainer)

**Content-Type:** `multipart/form-data` (when uploading thumbnail file) or `application/json`

#### Request Body

| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | string | ✅ | Non-empty |
| `description` | string | ✅ | Non-empty |
| `tags` | string or string[] | ❌ | Comma-separated slugs or array. Unknown slugs silently dropped. |
| `status` | string | ❌ | `draft` \| `pending` \| `published`. Default: `draft` |
| `accessLevel` | string | ❌ | `free` \| `develop` \| `master`. Default: `free` |
| `visibility` | string | ❌ | `clinicians` \| `users` \| `all`. Default: `users` |
| `thumbnailUrl` | string | ❌ | External URL |
| `thumbnail` (file) | image | ❌ | Must be `image/*` MIME type. Max 100 MB. Uploaded to `course_thumbnails/` in Cloudinary. |

#### Example Request (JSON)

```bash
curl -X POST https://api.example.com/api/courses \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{
    "title": "Introduction to Physiotherapy",
    "description": "A comprehensive guide to physiotherapy fundamentals.",
    "tags": "physiotherapy,rehabilitation",
    "status": "draft",
    "accessLevel": "free",
    "visibility": "all"
  }'
```

#### Example Request (multipart with thumbnail)

```bash
curl -X POST https://api.example.com/api/courses \
  -H "Cookie: better-auth.session_token=<token>" \
  -F "title=Introduction to Physiotherapy" \
  -F "description=A comprehensive guide to physiotherapy fundamentals." \
  -F "status=draft" \
  -F "accessLevel=free" \
  -F "visibility=all" \
  -F "thumbnail=@/path/to/thumbnail.jpg"
```

#### Response `201`

```json
{
  "success": true,
  "message": "Course created",
  "data": {
    "_id": "6650a1b2c3d4e5f6a7b8c9d0",
    "title": "Introduction to Physiotherapy",
    "description": "A comprehensive guide to physiotherapy fundamentals.",
    "tags": ["physiotherapy", "rehabilitation"],
    "status": "draft",
    "accessLevel": "free",
    "visibility": "all",
    "thumbnailUrl": "",
    "thumbnailCloudinaryId": "",
    "user": "6640a1b2c3d4e5f6a7b8c9d0",
    "createdBy": {
      "_id": "6640a1b2c3d4e5f6a7b8c9d0",
      "name": "Jane Smith",
      "email": "jane@example.com"
    },
    "chapters": [],
    "resources": [],
    "totalDurationSeconds": 0,
    "totalQuizzes": 0,
    "totalChapters": 0,
    "createdAt": "2026-05-15T10:00:00.000Z",
    "updatedAt": "2026-05-15T10:00:00.000Z"
  }
}
```

#### Side Effects

- If `status: "pending"`: fires push notification (FCM or Expo) to all admin users. Creates an in-app `Notification` record for each admin.

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `400` | `Title and description are required.` | Missing `title` or `description` |
| `400` | `Invalid thumbnail file type` | Uploaded file is not `image/*` |
| `400` | `Thumbnail size exceeds 100 MB` | File too large |
| `400` | `Invalid visibility` | `visibility` not in allowed values |
| `401` | `Unauthorized` | No active session |
| `403` | `Forbidden: insufficient permissions` | Role lacks `course:create` |
| `500` | `Failed to upload thumbnail to Cloudinary` | Cloudinary upload error |

---

### GET /api/courses

**Purpose:** Management-facing paginated list. Shows courses scoped by role.

**Permission:** `courseVideoStatus:view` (admin, trainer, trainee — user role is blocked)

**Role-based query scope:**

| Role | Visible courses |
|---|---|
| `admin` (no status filter) | Own draft courses + all pending + all published |
| `admin` + `status=draft` | Own draft courses only |
| `admin` + `status=pending` | All pending courses |
| `admin` + `status=published` | All published courses |
| `admin` + `status=rejected` | All rejected courses |
| `trainer` (no status filter) | All own courses (any status) |
| `trainer` + `status=published` | All published courses (by any trainer) |
| `trainer` + `status=<other>` | Own courses with that status |
| `trainee` | Published courses only (or filtered by `status` param) |

**Query Parameters:** See [Section 4](#4-pagination-filtering--sorting).

#### Example Request

```bash
curl -X GET "https://api.example.com/api/courses?page=1&limit=10&status=pending&q=physio" \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Response `200`

```json
{
  "success": true,
  "message": "Courses fetched",
  "data": [
    {
      "_id": "6650a1b2c3d4e5f6a7b8c9d0",
      "title": "Introduction to Physiotherapy",
      "description": "A comprehensive guide to physiotherapy fundamentals.",
      "tags": ["physiotherapy"],
      "status": "pending",
      "accessLevel": "free",
      "visibility": "all",
      "thumbnailUrl": "https://res.cloudinary.com/example/image/upload/v123/course_thumbnails/abc.jpg",
      "totalDurationSeconds": 1830,
      "totalQuizzes": 1,
      "totalChapters": 3,
      "user": "6640a1b2c3d4e5f6a7b8c9d0",
      "createdBy": {
        "_id": "6640a1b2c3d4e5f6a7b8c9d0",
        "name": "Jane Smith",
        "email": "jane@example.com"
      },
      "createdAt": "2026-05-15T10:00:00.000Z",
      "updatedAt": "2026-05-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "offset": 0,
    "limit": 10,
    "total": 1,
    "hasNext": false
  }
}
```

> `chapters` is excluded from the list response. `thumbnailUrl` falls back to the first lesson video thumbnail when the course-level thumbnail is empty.

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `400` | `Invalid status filter` | `status` not in allowed values |
| `400` | `Invalid tag filter: unknown tags` | All provided tags are unknown |
| `401` | `Unauthorized` | No active session |
| `403` | `Forbidden: insufficient permissions` | `user` role or unauthenticated |

---

### GET /api/courses/published-videos

**Purpose:** Consumer-facing paginated list. Published courses only, visibility-filtered by role. Includes per-course progress summary and saved status for the requesting user.

**Permission:** `course:view` (all roles)

**Visibility filtering:**

| Role | Visible `visibility` values |
|---|---|
| `admin` / `trainer` / `trainee` | `clinicians`, `users`, `all` |
| `user` | `all` only |

#### Example Request

```bash
curl -X GET "https://api.example.com/api/courses/published-videos?page=1&limit=10&sortBy=createdAt&order=desc" \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Response `200`

```json
{
  "success": true,
  "message": "Published courses fetched",
  "data": [
    {
      "_id": "6650a1b2c3d4e5f6a7b8c9d0",
      "title": "Introduction to Physiotherapy",
      "description": "A comprehensive guide.",
      "tags": ["physiotherapy"],
      "status": "published",
      "accessLevel": "free",
      "visibility": "all",
      "thumbnailUrl": "https://res.cloudinary.com/example/image/upload/v123/course_thumbnails/abc.jpg",
      "totalDurationSeconds": 1830,
      "user": "6640a1b2c3d4e5f6a7b8c9d0",
      "createdBy": {
        "_id": "6640a1b2c3d4e5f6a7b8c9d0",
        "name": "Jane Smith",
        "email": "jane@example.com"
      },
      "createdAt": "2026-05-15T10:00:00.000Z",
      "updatedAt": "2026-05-15T10:00:00.000Z",
      "saved": false,
      "progressSummary": {
        "percentCompleted": 45.50,
        "completed": false
      }
    }
  ],
  "pagination": {
    "page": 1,
    "offset": 0,
    "limit": 10,
    "total": 1,
    "hasNext": false
  }
}
```

**`progressSummary` calculation:**
- `percentCompleted` = average of `lessonsPercentWatched` and `quizAttemptedPercent` (if both components exist); otherwise the single present component.
- `completed` = `true` when `percentCompleted >= 90`.

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `400` | `Invalid tag filter: unknown tags` | All provided tags are unknown |
| `401` | `Unauthorized` | No active session |
| `403` | `Forbidden: insufficient permissions` | Role lacks `course:view` |

---

### GET /api/courses/completed

**Purpose:** Returns published courses the current user has completed (≥ 90% video watched).

**Permission:** `course:view` (all roles)

> **Implementation note:** Fetches ALL matching published courses into memory, computes completion ratio per course using `LessonVideoProgress`, then filters and paginates. `total` in pagination reflects completed count only.

**Completion definition:** `percentWatched >= 90` OR `watchedSeconds >= videoDurationSeconds` (where `videoDurationSeconds = totalDurationSeconds − totalQuizzes × 30`).

#### Example Request

```bash
curl -X GET "https://api.example.com/api/courses/completed?page=1&limit=10" \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Response `200`

```json
{
  "success": true,
  "message": "Completed courses fetched",
  "data": [
    {
      "_id": "6650a1b2c3d4e5f6a7b8c9d0",
      "title": "Introduction to Physiotherapy",
      "description": "A comprehensive guide.",
      "tags": ["physiotherapy"],
      "status": "published",
      "accessLevel": "free",
      "thumbnailUrl": "https://res.cloudinary.com/...",
      "totalDurationSeconds": 1830,
      "totalQuizzes": 1,
      "user": "6640a1b2c3d4e5f6a7b8c9d0",
      "createdBy": {
        "_id": "6640a1b2c3d4e5f6a7b8c9d0",
        "name": "Jane Smith",
        "email": "jane@example.com"
      },
      "createdAt": "2026-05-15T10:00:00.000Z",
      "updatedAt": "2026-05-15T10:00:00.000Z",
      "progressSummary": {
        "watchedSeconds": 1800,
        "percentWatched": 100.0,
        "completed": true,
        "durationSeconds": 1800
      }
    }
  ],
  "pagination": {
    "page": 1,
    "offset": 0,
    "limit": 10,
    "total": 1,
    "hasNext": false
  }
}
```

---

### GET /api/courses/saved-course

**Purpose:** Returns courses the current user has bookmarked, ordered by save time (newest first).

**Permission:** `course:view` (all roles)

> Ordering is preserved from `SavedCourse` document insertion time. `total` reflects all saved courses, not just the current page.

#### Example Request

```bash
curl -X GET "https://api.example.com/api/courses/saved-course?page=1&limit=10" \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Response `200`

```json
{
  "success": true,
  "message": "Saved courses fetched",
  "data": [
    {
      "_id": "6650a1b2c3d4e5f6a7b8c9d0",
      "title": "Introduction to Physiotherapy",
      "description": "A comprehensive guide.",
      "tags": ["physiotherapy"],
      "status": "published",
      "accessLevel": "free",
      "thumbnailUrl": "https://res.cloudinary.com/...",
      "totalDurationSeconds": 1830,
      "totalQuizzes": 1,
      "user": "6640a1b2c3d4e5f6a7b8c9d0",
      "createdBy": { "_id": "...", "name": "Jane Smith", "email": "jane@example.com" },
      "createdAt": "2026-05-15T10:00:00.000Z",
      "updatedAt": "2026-05-15T10:00:00.000Z",
      "progressSummary": {
        "watchedSeconds": 900,
        "percentWatched": 50.0,
        "completed": false,
        "durationSeconds": 1800
      }
    }
  ],
  "pagination": {
    "page": 1,
    "offset": 0,
    "limit": 10,
    "total": 1,
    "hasNext": false
  }
}
```

---

### GET /api/courses/:id

**Purpose:** Fetch full course document including all chapters, lessons, quizzes, and video metadata.

**Permission:** `course:view` (all roles)

**Access rules:**

- Clinicians (admin / trainer / trainee) and course owners: unrestricted — any status, any visibility.
- `user` role: all three conditions must be met:
  1. `course.status === "published"`
  2. `course.visibility === "all"`
  3. `course.accessLevel` is within the user's `accountType` tier

**Side effect:** Every lesson video's `cloudinaryUrl` is replaced on-the-fly with an HLS streaming URL (`format: m3u8`, `streaming_profile: auto`). This transform is response-only and never modifies the database.

#### Example Request

```bash
curl -X GET "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0" \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Response `200`

```json
{
  "success": true,
  "message": "Course fetched",
  "data": {
    "_id": "6650a1b2c3d4e5f6a7b8c9d0",
    "title": "Introduction to Physiotherapy",
    "description": "A comprehensive guide.",
    "tags": ["physiotherapy"],
    "status": "published",
    "accessLevel": "free",
    "visibility": "all",
    "thumbnailUrl": "https://res.cloudinary.com/...",
    "thumbnailCloudinaryId": "course_thumbnails/abc123",
    "user": "6640a1b2c3d4e5f6a7b8c9d0",
    "createdBy": { "_id": "...", "name": "Jane Smith", "email": "jane@example.com" },
    "totalDurationSeconds": 1830,
    "totalQuizzes": 1,
    "totalChapters": 2,
    "resources": [
      {
        "name": "study-guide.pdf",
        "url": "https://res.cloudinary.com/...",
        "cloudinaryId": "courses/abc/resources/xyz",
        "mimeType": "application/pdf",
        "sizeBytes": 204800
      }
    ],
    "chapters": [
      {
        "_id": "6650b1b2c3d4e5f6a7b8c9d1",
        "title": "Chapter 1: Foundations",
        "lessons": [
          {
            "_id": "6650c1b2c3d4e5f6a7b8c9d2",
            "title": "Lesson 1",
            "description": "Introduction to movement analysis.",
            "videos": [
              {
                "title": "Lesson 1",
                "cloudinaryUrl": "https://res.cloudinary.com/.../course-videos/abc/0/0/ts1.m3u8",
                "cloudinaryId": "course-videos/abc/0/0/ts1",
                "durationSeconds": 900,
                "thumbnailUrl": "https://res.cloudinary.com/.../thumbnail.jpg",
                "subtitle_status": "done",
                "subtitles": [
                  { "language": "en", "url": "https://..." }
                ]
              }
            ]
          }
        ],
        "quizzes": [
          {
            "_id": "6650d1b2c3d4e5f6a7b8c9d3",
            "title": "Chapter 1 Quiz",
            "questions": [
              {
                "type": "single",
                "prompt": "What is the primary function of physiotherapy?",
                "options": [
                  { "text": "Pain management" },
                  { "text": "Movement restoration" },
                  { "text": "Surgical intervention" }
                ],
                "correctOptionIndexes": [1]
              }
            ]
          }
        ]
      }
    ],
    "createdAt": "2026-05-15T10:00:00.000Z",
    "updatedAt": "2026-05-15T10:00:00.000Z"
  }
}
```

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `401` | `Unauthorized` | No active session |
| `403` | `Forbidden: insufficient permissions` | Role lacks `course:view` |
| `403` | `Forbidden: course not accessible` | `user` role, course not published |
| `403` | `Forbidden: this content is for clinicians only` | `user` role, `visibility !== "all"` |
| `403` | `Forbidden: upgrade your account to access this content` | `user` role, `accessLevel` beyond `accountType` |
| `404` | `Course not found` | Invalid or missing `id` |

---

### PATCH /api/courses/:id

**Purpose:** Update course metadata, thumbnail, status, or full chapters structure.

**Permission:** `course:create` (admin, trainer)

**Ownership:** Admin or course owner only.

> All fields are optional. Only send the fields you want to change.

#### Request Body

| Field | Type | Constraints |
|---|---|---|
| `title` | string | Non-empty string |
| `description` | string | — |
| `tags` | string or string[] | Known slugs only. All-unknown tags return `400`. |
| `accessLevel` | string | `free` \| `develop` \| `master` |
| `visibility` | string | `clinicians` \| `users` \| `all` |
| `status` | string | `draft` \| `pending` \| `published`. Only admin can set `published`. |
| `chapters` | array | Full replacement of the chapters array. Triggers `recomputeCourseStats` and subtitle job re-enqueue. |
| `thumbnailUrl` | string | External URL. Pass `""` to clear the thumbnail (also destroys Cloudinary asset if one exists). |
| `thumbnail` (file) | image | Replaces existing thumbnail. Old Cloudinary asset is destroyed before new one is uploaded. |

#### Example Request (JSON)

```bash
curl -X PATCH "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0" \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{
    "title": "Advanced Physiotherapy",
    "status": "pending",
    "accessLevel": "develop",
    "visibility": "all"
  }'
```

#### Example Request (replace thumbnail file)

```bash
curl -X PATCH "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0" \
  -H "Cookie: better-auth.session_token=<token>" \
  -F "thumbnail=@/path/to/new-thumbnail.jpg"
```

#### Response `200`

Updated full course document (same shape as `POST /courses` response).

#### Side Effects

- If `chapters` replaced: `recomputeCourseStats` runs synchronously; `enqueueCourseSubtitleJobs` fires asynchronously.
- If `thumbnailUrl` set to `""` and a Cloudinary ID existed: old asset is destroyed.
- If `thumbnail` file is uploaded and a prior Cloudinary thumbnail existed: old asset is destroyed before new upload.

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `400` | `title must be a string` | Wrong type for `title` |
| `400` | `Invalid accessLevel` | Not in allowed values |
| `400` | `Invalid visibility` | Not in allowed values |
| `400` | `Invalid status` | Not in allowed values |
| `400` | `Invalid tags: provide existing tag slugs` | All supplied tags unknown |
| `400` | `chapters must be an array` | `chapters` is not an array |
| `400` | `Invalid thumbnail file type` | File is not `image/*` |
| `400` | `Thumbnail size exceeds 100 MB` | File too large |
| `403` | `Forbidden: only admin can set published` | Non-admin tries to set `published` |
| `403` | `Forbidden: only admin or owner can edit` | Not admin or owner |
| `404` | `Course not found` | Invalid `id` |
| `500` | `Failed to upload thumbnail to Cloudinary` | Cloudinary error |

---

### DELETE /api/courses/:id

**Purpose:** Hard-delete a course and all associated Cloudinary assets.

**Permission:** Admin or owner only (no `userHasPermission` check — direct role/ownership gate only).

#### Example Request

```bash
curl -X DELETE "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0" \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Response `200`

```json
{
  "success": true,
  "message": "Course deleted",
  "data": { "id": "6650a1b2c3d4e5f6a7b8c9d0" }
}
```

#### Side Effects (sequential, errors are logged but non-fatal)

1. Destroys all lesson videos from Cloudinary (`resource_type: video`).
2. Destroys course thumbnail from Cloudinary (uses `thumbnailCloudinaryId`, or infers `public_id` from URL if not stored).
3. Destroys all resource files from Cloudinary (MIME-based `resource_type` detection).
4. Attempts `delete_resources_by_prefix` + `delete_folder` for `courses/{id}/resources` folder.
5. Hard-deletes the `Course` document from MongoDB.

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `400` | `Invalid course ID format.` | `id` is not a valid ObjectId |
| `401` | `Unauthorized` | No active session |
| `403` | `Forbidden: only admin or owner can delete` | Not admin or owner |
| `404` | `Course not found` | Course does not exist |
| `500` | `Failed to delete course from database.` | MongoDB delete failed |

---

### DELETE /api/courses/:id/thumbnail

**Purpose:** Remove the course thumbnail (both from Cloudinary and the course document).

**Permission:** Admin or owner only.

#### Example Request

```bash
curl -X DELETE "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0/thumbnail" \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Response `200`

Updated course document with `thumbnailUrl: ""` and `thumbnailCloudinaryId: ""`.

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `401` | `Unauthorized` | No active session |
| `403` | `Forbidden: only admin or owner can delete thumbnail` | Not admin or owner |
| `404` | `Course not found` | Invalid `id` |

---

### GET /api/courses/:id/progress

**Purpose:** Full course document with per-lesson, per-quiz progress for the requesting user.

**Permission:** `course:view` (all roles)

**Access:** Admin and course owner bypass status check. All others require `status: "published"`.

#### Example Request

```bash
curl -X GET "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0/progress" \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Response `200`

```json
{
  "success": true,
  "message": "Course with progress",
  "data": {
    "courseId": "6650a1b2c3d4e5f6a7b8c9d0",
    "title": "Introduction to Physiotherapy",
    "createdBy": { "_id": "...", "name": "Jane Smith", "email": "jane@example.com" },
    "chapters": [
      {
        "chapterId": "6650b1b2c3d4e5f6a7b8c9d1",
        "chapterIndex": 0,
        "title": "Chapter 1: Foundations",
        "durationSeconds": 900,
        "watchedSeconds": 450,
        "lessonsPercentWatched": 50.0,
        "quizAttemptedPercent": 100.0,
        "percentCompleted": 75.0,
        "lessons": [
          {
            "lessonIndex": 0,
            "title": "Lesson 1",
            "videos": [ { "cloudinaryUrl": "...", "durationSeconds": 900, "thumbnailUrl": "..." } ],
            "durationSeconds": 900,
            "watchedSeconds": 450,
            "percentWatched": 50.0,
            "completed": false
          }
        ],
        "quiz": {
          "title": "Chapter 1 Quiz",
          "attempted": true,
          "totalQuestions": 2,
          "attemptedCount": 2,
          "attemptedPercent": 100.0,
          "questions": [
            {
              "questionIndex": 0,
              "type": "single",
              "prompt": "What is the primary function of physiotherapy?",
              "options": [
                { "text": "Pain management" },
                { "text": "Movement restoration" },
                { "text": "Surgical intervention" }
              ],
              "attempted": true,
              "userSelectedOptionIndexes": [0],
              "isCorrect": false,
              "correctOptionIndexes": [1]
            },
            {
              "questionIndex": 1,
              "type": "single",
              "prompt": "How many planes of movement are there?",
              "options": [{ "text": "2" }, { "text": "3" }, { "text": "4" }],
              "attempted": true,
              "userSelectedOptionIndexes": [1],
              "isCorrect": true
            }
          ]
        }
      }
    ]
  }
}
```

**Important notes on response:**

- `correctOptionIndexes` is only present on a question when the user has answered it **incorrectly**. It is omitted for correctly-answered or unattempted questions.
- `percentCompleted` per chapter = average of `lessonsPercentWatched` and `quizAttemptedPercent` when both exist. If only one component exists, that component's value is used alone.
- Quiz `attemptedPercent` counts unique question indexes attempted (deduplicates across multiple submissions).
- Lesson `watchedSeconds` is capped at `durationSeconds` — cannot exceed 100%.

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `401` | `Unauthorized` | No active session |
| `403` | `Forbidden: insufficient permissions` | Role lacks `course:view` |
| `403` | `Forbidden: course not accessible` | Not published, not admin or owner |
| `404` | `Course not found` | Invalid `id` |

---

### POST /api/courses/:id/save

**Purpose:** Bookmark or un-bookmark a course for the current user. Fully idempotent.

**Permission:** `course:view` (all roles)

#### Request Body

```json
{ "save": true }
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `save` | boolean | ✅ | Must be exactly `true` or `false` (not a string) |

#### Example Request (save)

```bash
curl -X POST "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0/save" \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{ "save": true }'
```

#### Example Request (unsave)

```bash
curl -X POST "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0/save" \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{ "save": false }'
```

#### Response `200` (saved)

```json
{
  "success": true,
  "message": "Course saved",
  "data": {
    "courseId": "6650a1b2c3d4e5f6a7b8c9d0",
    "saved": true,
    "_id": "6660a1b2c3d4e5f6a7b8c9d0"
  }
}
```

#### Response `200` (unsaved)

```json
{
  "success": true,
  "message": "Course unsaved",
  "data": {
    "courseId": "6650a1b2c3d4e5f6a7b8c9d0",
    "saved": false
  }
}
```

> Saving an already-saved course returns `200` (not `409`). Unsaving a non-saved course also returns `200`.

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `400` | `Invalid course ID format.` | `id` is not a valid ObjectId |
| `400` | `Invalid request: 'save' boolean is required` | `save` is not a boolean |
| `403` | `Forbidden: course not accessible` | Course not published, not admin or owner |
| `404` | `Course not found` | Invalid `id` |

---

### POST /api/courses/:id/resources/upload

**Purpose:** Upload up to 10 resource files (PDF, video, image, etc.) to a course.

**Permission:** `course:create` (admin, trainer)

**Ownership:** Admin or owner only.

**Content-Type:** `multipart/form-data`, field name `files`, max 20 files per request.

**Limits:**
- Hard cap: 10 total resources per course (checked before upload — returns `400` if adding would exceed it).
- Per-file size cap: 2 GB (files over limit are skipped and reported in `skippedTooLarge`).

#### Example Request

```bash
curl -X POST "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0/resources/upload" \
  -H "Cookie: better-auth.session_token=<token>" \
  -F "files=@/path/to/study-guide.pdf" \
  -F "files=@/path/to/exercise-chart.png"
```

#### Response `200`

```json
{
  "success": true,
  "message": "Resources uploaded",
  "data": {
    "added": [
      {
        "name": "study-guide.pdf",
        "url": "https://res.cloudinary.com/example/raw/upload/v123/courses/abc/resources/study-guide.pdf",
        "cloudinaryId": "courses/abc/resources/study-guide",
        "mimeType": "application/pdf",
        "sizeBytes": 204800
      },
      {
        "name": "exercise-chart.png",
        "url": "https://res.cloudinary.com/example/image/upload/v123/courses/abc/resources/exercise-chart.png",
        "cloudinaryId": "courses/abc/resources/exercise-chart",
        "mimeType": "image/png",
        "sizeBytes": 51200
      }
    ],
    "skippedTooLarge": [],
    "failed": []
  }
}
```

> Upload is parallel (`Promise.all`). Partial success is allowed — some files may succeed while others fail or are skipped. The course is saved with only the successfully uploaded files.

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `400` | `No files provided` | No files in request |
| `400` | `Adding N resource(s) would exceed the maximum of 10` | Would exceed resource cap |
| `401` | `Unauthorized` | No active session |
| `403` | `Forbidden: insufficient permissions` | Role lacks `course:create` |
| `403` | `Forbidden: only admin or owner can upload resources` | Not admin or owner |
| `404` | `Course not found` | Invalid `id` |

---

### DELETE /api/courses/:id/resources/:resourceIndex

**Purpose:** Delete a single resource by zero-based index.

**Permission:** `course:create` (admin, trainer)

**Ownership:** Admin or owner only.

#### Example Request

```bash
curl -X DELETE "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0/resources/0" \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Response `200`

```json
{
  "success": true,
  "message": "Resource deleted",
  "data": {
    "resourceIndex": 0,
    "deleted": {
      "name": "study-guide.pdf",
      "cloudinaryId": "courses/abc/resources/study-guide"
    },
    "remainingCount": 1
  }
}
```

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `400` | `Invalid course ID format.` | `id` is not a valid ObjectId |
| `400` | `Invalid resourceIndex` | Not a non-negative integer |
| `403` | `Forbidden: only admin or owner can delete resources` | Not admin or owner |
| `404` | `Course not found` | Invalid `id` |
| `404` | `Resource not found` | Index out of bounds |

---

### POST /api/courses/:courseId/chapters

**Purpose:** Append a new empty chapter to a course.

**Permission:** `course:create` (admin, trainer)

**Ownership:** Admin or owner only.

#### Request Body

```json
{ "title": "Chapter 2: Advanced Techniques" }
```

| Field | Type | Required |
|---|---|---|
| `title` | string | ✅ |

#### Example Request

```bash
curl -X POST "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0/chapters" \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{ "title": "Chapter 2: Advanced Techniques" }'
```

#### Response `201`

```json
{
  "success": true,
  "message": "Chapter added",
  "data": {
    "_id": "6650e1b2c3d4e5f6a7b8c9d4",
    "title": "Chapter 2: Advanced Techniques",
    "lessons": [],
    "quizzes": []
  }
}
```

#### Side Effects

- `totalChapters` incremented via `recomputeCourseStats`.

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `400` | `Chapter title is required` | Missing `title` |
| `403` | `Forbidden: only admin or owner can edit` | Not admin or owner |
| `404` | `Course not found` | Invalid `courseId` |

---

### DELETE /api/courses/:courseId/chapters/:chapterIndex

**Purpose:** Remove a chapter by zero-based index and destroy all its lesson videos in Cloudinary.

**Permission:** `course:create` (admin, trainer)

**Ownership:** Admin or owner only.

#### Example Request

```bash
curl -X DELETE "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0/chapters/1" \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Response `200`

```json
{
  "success": true,
  "message": "Chapter deleted",
  "data": {
    "chapterIndex": 1,
    "chapterId": "6650e1b2c3d4e5f6a7b8c9d4"
  }
}
```

#### Side Effects

- All lesson videos in the chapter are destroyed in Cloudinary (errors logged, non-fatal).
- `recomputeCourseStats` runs synchronously.

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `400` | `Invalid chapterIndex` | Not a non-negative integer |
| `403` | `Forbidden: only admin or owner can edit` | Not admin or owner |
| `404` | `Course not found` | Invalid `courseId` |
| `404` | `Chapter not found` | Index out of bounds |

---

### POST /api/courses/:courseId/chapters/:chapterIndex/lessons

**Purpose:** Add or replace the lesson in a chapter. Each chapter supports exactly one lesson — a second call to this endpoint updates the existing lesson rather than creating another.

**Permission:** `course:create` (admin, trainer)

**Ownership:** Admin or owner only.

#### Request Body

| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | string | ✅ | Non-empty |
| `description` | string | ❌ | — |
| `videos` | array | ❌ | Each item must have `cloudinaryUrl` and `cloudinaryId`. |

**Video object:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `cloudinaryUrl` | string | ✅ | — |
| `cloudinaryId` | string | ✅ | — |
| `durationSeconds` | number | ❌ | Default `0` |
| `thumbnailUrl` | string | ❌ | Falls back to Cloudinary auto-generated frame at 1 second offset |

#### Example Request

```bash
curl -X POST "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0/chapters/0/lessons" \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{
    "title": "Lesson 1: Movement Analysis",
    "description": "Learn the fundamentals of movement analysis.",
    "videos": [
      {
        "cloudinaryUrl": "https://res.cloudinary.com/example/video/upload/v123/course-videos/abc/0/0/ts1.mp4",
        "cloudinaryId": "course-videos/abc/0/0/ts1",
        "durationSeconds": 900,
        "thumbnailUrl": "https://res.cloudinary.com/example/image/upload/v123/course-videos/abc/0/0/thumb.jpg"
      }
    ]
  }'
```

#### Response `201` (new lesson)

```json
{
  "success": true,
  "message": "Lesson added",
  "data": {
    "title": "Lesson 1: Movement Analysis",
    "description": "Learn the fundamentals of movement analysis.",
    "videos": [
      {
        "cloudinaryUrl": "https://res.cloudinary.com/...",
        "cloudinaryId": "course-videos/abc/0/0/ts1",
        "durationSeconds": 900,
        "thumbnailUrl": "https://res.cloudinary.com/.../thumb.jpg"
      }
    ]
  }
}
```

#### Response `200` (updated existing lesson)

Same shape with message `"Lesson updated"`.

#### Side Effects

- `recomputeCourseStats` runs synchronously.
- `enqueueCourseSubtitleJobs` fires asynchronously for all new videos without existing subtitles.

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `400` | `Lesson title is required` | Missing `title` |
| `400` | `Each video must have cloudinaryUrl and cloudinaryId` | Malformed video object |
| `400` | `Invalid chapterIndex` | Not a non-negative integer |
| `403` | `Forbidden: only admin or owner can edit` | Not admin or owner |
| `404` | `Chapter not found` | `chapterIndex` out of bounds |

---

### DELETE /api/courses/:courseId/chapters/:chapterIndex/lessons/:lessonIndex

**Purpose:** Delete a lesson and all its videos.

**Permission:** `course:create` (admin, trainer)

**Ownership:** Admin or owner only.

#### Example Request

```bash
curl -X DELETE "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0/chapters/0/lessons/0" \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Response `200`

```json
{
  "success": true,
  "message": "Lesson deleted",
  "data": {
    "chapterIndex": 0,
    "lessonIndex": 0
  }
}
```

#### Side Effects

All lesson videos are destroyed in Cloudinary (errors suppressed). `recomputeCourseStats` runs synchronously.

---

### POST /api/courses/:courseId/chapters/:chapterIndex/quizzes

**Purpose:** Add or replace the quiz in a chapter. Each chapter supports exactly one quiz.

**Permission:** `course:create` (admin, trainer)

**Ownership:** Admin or owner only.

#### Request Body

| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | string | Required on first create | — |
| `questions` | array | ❌ | See question schema below |

**Question object:**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `type` | string | ✅ | `single` \| `multiple` |
| `prompt` | string | ✅ | Non-empty |
| `options` | `{ text: string }[]` | ✅ | Min 1 option |
| `correctOptionIndexes` | number[] | ✅ | Min 1 index; must be valid 0-based option indexes. `single` type requires exactly 1. |

#### Example Request

```bash
curl -X POST "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0/chapters/0/quizzes" \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{
    "title": "Chapter 1 Quiz",
    "questions": [
      {
        "type": "single",
        "prompt": "What is the primary function of physiotherapy?",
        "options": [
          { "text": "Pain management" },
          { "text": "Movement restoration" },
          { "text": "Surgical intervention" }
        ],
        "correctOptionIndexes": [1]
      },
      {
        "type": "multiple",
        "prompt": "Which of the following are valid physiotherapy modalities?",
        "options": [
          { "text": "Manual therapy" },
          { "text": "Exercise prescription" },
          { "text": "Chemotherapy" }
        ],
        "correctOptionIndexes": [0, 1]
      }
    ]
  }'
```

#### Response `201` (new quiz)

```json
{
  "success": true,
  "message": "Quiz added",
  "data": {
    "_id": "6650d1b2c3d4e5f6a7b8c9d3",
    "title": "Chapter 1 Quiz",
    "questions": [
      {
        "type": "single",
        "prompt": "What is the primary function of physiotherapy?",
        "options": [{ "text": "Pain management" }, { "text": "Movement restoration" }, { "text": "Surgical intervention" }],
        "correctOptionIndexes": [1]
      },
      {
        "type": "multiple",
        "prompt": "Which of the following are valid physiotherapy modalities?",
        "options": [{ "text": "Manual therapy" }, { "text": "Exercise prescription" }, { "text": "Chemotherapy" }],
        "correctOptionIndexes": [0, 1]
      }
    ]
  }
}
```

#### Response `200` (updated existing quiz)

Same shape with message `"Quiz updated"`.

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `400` | `Quiz title is required` | First creation without `title` |
| `400` | `Invalid quiz question payload` | Missing required question fields |
| `400` | `Question type must be 'single' or 'multiple'` | Invalid `type` |
| `400` | `Question must have at least one option` | Empty `options` array |
| `400` | `correctOptionIndexes must include at least one index` | Empty `correctOptionIndexes` |
| `400` | `correctOptionIndexes contain invalid indexes` | Index out of options range |
| `400` | `Single-answer questions must have exactly one correct index` | Multiple correct for `single` type |

---

### DELETE /api/courses/:courseId/chapters/:chapterIndex/quizzes/:quizIndex

**Purpose:** Delete a quiz by zero-based index.

**Permission:** `course:create` (admin, trainer)

**Ownership:** Admin or owner only.

#### Example Request

```bash
curl -X DELETE "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0/chapters/0/quizzes/0" \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Response `200`

```json
{
  "success": true,
  "message": "Quiz deleted",
  "data": {
    "chapterIndex": 0,
    "quizIndex": 0
  }
}
```

---

### PATCH /api/courses/:courseId/chapters/:chapterIndex/lessons/:lessonIndex/video

**Purpose:** Legacy video upsert. The client provides Cloudinary metadata after uploading externally. Prefer the V1 signed-upload flow for new integrations.

**Permission:** No `userHasPermission` check — ownership enforced via course owner check only (admin or owner).

#### Request Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `cloudinaryUrl` | string | ✅ | — |
| `cloudinaryId` | string | ✅ | — |
| `durationSeconds` | number | ❌ | ≥ 0. Defaults to existing value or `0`. |
| `thumbnailUrl` | string | ❌ | Falls back to Cloudinary auto-frame at 1-second offset. |
| `title` | string | ❌ | Updates lesson title. |
| `description` | string | ❌ | Updates lesson description. |

#### Example Request

```bash
curl -X PATCH "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0/chapters/0/lessons/0/video" \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{
    "cloudinaryUrl": "https://res.cloudinary.com/example/video/upload/v123/course-videos/abc/0/0/ts1.mp4",
    "cloudinaryId": "course-videos/abc/0/0/ts1",
    "durationSeconds": 900
  }'
```

#### Response `200`

```json
{
  "success": true,
  "message": "Video added to lesson",
  "data": {
    "video": {
      "title": "Lesson 1",
      "cloudinaryUrl": "https://res.cloudinary.com/...",
      "cloudinaryId": "course-videos/abc/0/0/ts1",
      "durationSeconds": 900,
      "thumbnailUrl": "https://res.cloudinary.com/...",
      "subtitle_status": "pending",
      "subtitles": [],
      "subtitle_failure_reason": null,
      "subtitle_retry_count": 0,
      "last_subtitle_attempt": null,
      "retryable": false
    }
  }
}
```

**Subtitle preservation:** If the same `cloudinaryId` is re-saved, existing `subtitles`, `subtitle_status`, `subtitle_failure_reason`, `subtitle_retry_count`, and `last_subtitle_attempt` are preserved. A new `cloudinaryId` resets all subtitle fields.

#### Side Effects

- `recomputeCourseStats` runs synchronously.
- `enqueueCourseSubtitleJobs` fires asynchronously.

---

### DELETE /api/courses/:courseId/chapters/:chapterIndex/lessons/:lessonIndex/videos/:videoIndex

**Purpose:** Delete a specific lesson video by zero-based index.

**Permission:** `course:create` (admin, trainer)

**Ownership:** Admin or owner only.

#### Example Request

```bash
curl -X DELETE "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0/chapters/0/lessons/0/videos/0" \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Response `200`

```json
{
  "success": true,
  "message": "Lesson video deleted",
  "data": {
    "chapterIndex": 0,
    "lessonIndex": 0,
    "videoIndex": 0
  }
}
```

#### Side Effects

Video is destroyed in Cloudinary. `recomputeCourseStats` runs synchronously.

---

### PUT /api/courses/:courseId/chapters/:chapterId/lessons/progress

**Purpose:** Record watch time for a lesson (always lesson index `0`). Monotonically increasing — only updates if the new value is greater than the stored value.

**Authentication:** Session required. No `userHasPermission` check — all authenticated roles can call this.

**Note:** `chapterId` is the MongoDB `_id` of the chapter (not the chapter index).

#### Request Body

```json
{ "watchedSeconds": 360 }
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `watchedSeconds` | number | ✅ | ≥ 0. Capped at lesson `durationSeconds`. |

#### Example Request

```bash
curl -X PUT "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0/chapters/6650b1b2c3d4e5f6a7b8c9d1/lessons/progress" \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{ "watchedSeconds": 360 }'
```

#### Response `200`

```json
{
  "success": true,
  "message": "Lesson progress updated",
  "data": {
    "watchedSeconds": 360,
    "completed": false,
    "percentWatched": 40.0,
    "durationSeconds": 900
  }
}
```

**Completion threshold:** `completed = true` when `percentWatched >= 90` OR `watchedSeconds >= durationSeconds`.

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `400` | `Invalid course ID format.` | `courseId` not a valid ObjectId |
| `400` | `Invalid chapter ID format.` | `chapterId` not a valid ObjectId |
| `400` | `Invalid watchedSeconds` | Not a non-negative number |
| `404` | `Course not found` | Invalid `courseId` |
| `404` | `Chapter not found` | `chapterId` not found in course |
| `404` | `Lesson not found` | No lesson at index 0 |

---

### POST /api/courses/:courseId/chapters/:chapterId/quiz/responses

**Purpose:** Submit quiz answers for a chapter. Auto-grades each answer.

**Permission:** `course:view` (all roles)

**Access:** Admin and course owner bypass status check. Others require `status: "published"`.

**Note:** `chapterId` is the MongoDB `_id` of the chapter.

#### Request Body

```json
{
  "answers": [
    { "questionIndex": 0, "selectedOptionIndexes": [1] },
    { "questionIndex": 1, "selectedOptionIndexes": [0, 1] }
  ]
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `answers` | array | ✅ | Non-empty |
| `answers[].questionIndex` | number | ✅ | 0-based, must be within question count |
| `answers[].selectedOptionIndexes` | number[] | ✅ | Valid 0-based option indexes. `single` type requires exactly 1. `multiple` requires ≥ 1. |

#### Example Request

```bash
curl -X POST "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0/chapters/6650b1b2c3d4e5f6a7b8c9d1/quiz/responses" \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{
    "answers": [
      { "questionIndex": 0, "selectedOptionIndexes": [1] },
      { "questionIndex": 1, "selectedOptionIndexes": [0, 1] }
    ]
  }'
```

#### Response `201`

```json
{
  "success": true,
  "message": "Quiz responses saved",
  "data": {
    "_id": "6670a1b2c3d4e5f6a7b8c9d0",
    "userId": "6640a1b2c3d4e5f6a7b8c9d0",
    "courseId": "6650a1b2c3d4e5f6a7b8c9d0",
    "chapterId": "6650b1b2c3d4e5f6a7b8c9d1",
    "quizIndex": 0,
    "answers": [
      { "questionIndex": 0, "selectedOptionIndexes": [1], "isCorrect": true },
      { "questionIndex": 1, "selectedOptionIndexes": [0, 1], "isCorrect": true }
    ],
    "createdAt": "2026-05-15T10:30:00.000Z",
    "updatedAt": "2026-05-15T10:30:00.000Z"
  }
}
```

**Grading:** `isCorrect = true` when the sorted selected indexes exactly match the sorted `correctOptionIndexes` for the question.

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `400` | `answers must be a non-empty array` | Missing or empty `answers` |
| `400` | `Invalid questionIndex: X` | `questionIndex` out of range |
| `400` | `Question X requires exactly one option` | `single` type with ≠ 1 selection |
| `400` | `Question X requires at least one option` | `multiple` type with 0 selections |
| `403` | `Forbidden: course not accessible` | Course not published, not admin or owner |
| `404` | `Chapter not found` | `chapterId` not found |
| `404` | `Quiz not found for this chapter` | Chapter has no quiz |
| `404` | `Quiz has no questions` | Quiz exists but `questions` is empty |

---

### PUT /api/admin/change-status-course/:id

**Purpose:** Update the lifecycle status of a course.

**Authentication:** Session required. No `userHasPermission` check — manual role gate.

**Role gates:**

| Role | Allowed `status` values |
|---|---|
| `admin` | `draft`, `pending`, `published`, `rejected` |
| `trainer`, `trainee` | `draft`, `pending` |
| `user` | ❌ `403` |

#### Request Body

```json
{
  "status": "published",
  "rejectReason": ""
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `status` | string | ✅ | `draft` \| `pending` \| `published` \| `rejected` |
| `rejectReason` | string | Conditional | Required and non-empty when `status: "rejected"` |

#### Example Request (approve)

```bash
curl -X PUT "https://api.example.com/api/admin/change-status-course/6650a1b2c3d4e5f6a7b8c9d0" \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{ "status": "published" }'
```

#### Example Request (reject)

```bash
curl -X PUT "https://api.example.com/api/admin/change-status-course/6650a1b2c3d4e5f6a7b8c9d0" \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{
    "status": "rejected",
    "rejectReason": "Content does not meet clinical accuracy standards."
  }'
```

#### Response `200`

Updated full course document.

#### Side Effects

- Fires push notification (FCM or Expo) to the course owner (if owner ≠ requester).
- Creates an in-app `Notification` record for the course owner.
- Notification body:
  - `published` → `Your "{title}" has been approved.`
  - `rejected` → `Your "{title}" was declined. Please review the feedback: {rejectReason}`
  - other → `Your "{title}" is now {status}.`
- When `status !== "rejected"`, `rejectReason` is cleared to `""` in the database.

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `400` | `Invalid status` | `status` not in allowed values |
| `400` | `rejectReason is required when status is 'rejected'` | Missing or empty `rejectReason` |
| `401` | `Unauthorized` | No active session |
| `403` | `Forbidden: your role cannot set the requested status` | Role not allowed to set that status |
| `404` | `Course not found` | Invalid `id` |

---

### POST /api/courses/videos-upload

**Purpose:** Legacy validation endpoint. Validates and echoes Cloudinary video metadata. Makes no database writes. Use before calling `PATCH .../video` to confirm metadata is well-formed.

**Permission:** `course:create` (admin, trainer)

#### Request Body

```json
{
  "cloudinaryUrl": "https://res.cloudinary.com/example/video/upload/v123/course-videos/abc.mp4",
  "cloudinaryId": "course-videos/abc",
  "thumbnailUrl": "https://res.cloudinary.com/example/image/upload/v123/thumb.jpg",
  "durationSeconds": 120
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `cloudinaryUrl` | string | ✅ | — |
| `cloudinaryId` | string | ✅ | — |
| `thumbnailUrl` | string | ✅ | — |
| `durationSeconds` | number | ✅ | Non-negative number |

#### Example Request

```bash
curl -X POST "https://api.example.com/api/courses/videos-upload" \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{
    "cloudinaryUrl": "https://res.cloudinary.com/example/video/upload/v123/course-videos/abc.mp4",
    "cloudinaryId": "course-videos/abc",
    "thumbnailUrl": "https://res.cloudinary.com/example/image/upload/v123/thumb.jpg",
    "durationSeconds": 120
  }'
```

#### Response `200`

```json
{
  "success": true,
  "message": "Video metadata received",
  "data": {
    "cloudinaryUrl": "https://res.cloudinary.com/example/video/upload/v123/course-videos/abc.mp4",
    "cloudinaryId": "course-videos/abc",
    "durationSeconds": 120,
    "thumbnailUrl": "https://res.cloudinary.com/example/image/upload/v123/thumb.jpg"
  }
}
```

---

### POST /api/courses/delete-cloudinary-video

**Purpose:** Direct Cloudinary asset deletion by public ID. Does not touch the database.

**Permission:** Manual role check — admin or trainer only (no `userHasPermission`).

#### Request Body

```json
{
  "publicId": "course-videos/abc/0/0/ts1",
  "resourceType": "video"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `publicId` | string | ✅ | Cloudinary `public_id` |
| `resourceType` | string | ❌ | `video` \| `image` \| `raw`. Default: `video` |

#### Example Request

```bash
curl -X POST "https://api.example.com/api/courses/delete-cloudinary-video" \
  -H "Content-Type: application/json" \
  -H "Cookie: better-auth.session_token=<token>" \
  -d '{
    "publicId": "course-videos/6650a1b2c3d4e5f6a7b8c9d0/0/0/ts1",
    "resourceType": "video"
  }'
```

#### Response `200`

```json
{
  "success": true,
  "message": "Video deleted successfully",
  "data": { "result": "ok" }
}
```

#### Error Cases

| Status | Message | Cause |
|---|---|---|
| `400` | `publicId is required` | Missing `publicId` |
| `403` | `Forbidden: insufficient permissions` | Not admin or trainer |
| `500` | `Failed to delete from Cloudinary` | Cloudinary returned non-`ok` result |

---

### POST /api/courses/:courseId/retry-subtitles

**Purpose:** Re-queue failed subtitle generation jobs for a course.

**Permission:** Admin or trainer (enforced in `retryCourseSubtitles` controller).

#### Example Request

```bash
curl -X POST "https://api.example.com/api/courses/6650a1b2c3d4e5f6a7b8c9d0/retry-subtitles" \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Response `200`

```json
{
  "success": true,
  "message": "Subtitle retry enqueued",
  "data": { "enqueued": 2 }
}
```

---

## 6. V1 Signed Upload Flow

### Overview

The V1 flow removes the trust requirement on the client to supply Cloudinary metadata. The backend signs the upload directly and the webhook delivers verified metadata.

```
Client                    Backend                          Cloudinary
  |                          |                                 |
  |-- POST signed-upload-url -->|                              |
  |<-- { uploadUrl, fields } --|                              |
  |                          |                                 |
  |-- PUT uploadUrl (multipart) --------------------------->  |
  |<-- { secure_url, public_id, duration } ----------------- |
  |                          |                                 |
  |                          |<-- POST /webhooks/upload-complete
  |                          |    (notification_url callback)  |
  |                          |-- verify HMAC signature         |
  |                          |-- update Course document        |
  |                          |-- enqueue CourseSubtitleJob     |
  |                          |                                 |
  |-- GET video-status ------>|                               |
  |<-- { videoReady, cloudinaryId, durationSeconds } -------- |
```

---

### POST /api/v1/courses/:courseId/chapters/:chapterIndex/lessons/:lessonIndex/signed-upload-url

**Purpose:** Issue a Cloudinary signed upload URL for a specific lesson video slot.

**Authentication:** Session required. Admin or course owner only.

#### Path Parameters

| Parameter | Type | Constraints |
|---|---|---|
| `courseId` | string | Valid MongoDB ObjectId |
| `chapterIndex` | integer | ≥ 0, chapter must exist |
| `lessonIndex` | integer | ≥ 0, lesson must exist |

#### Example Request

```bash
curl -X POST "https://api.example.com/api/v1/courses/6650a1b2c3d4e5f6a7b8c9d0/chapters/0/lessons/0/signed-upload-url" \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Response `200`

```json
{
  "success": true,
  "message": "Signed upload URL generated",
  "data": {
    "uploadUrl": "https://api.cloudinary.com/v1_1/{cloudName}/video/upload",
    "fields": {
      "api_key": "123456789012345",
      "timestamp": 1715769600,
      "signature": "abc123def456...",
      "public_id": "course-videos/6650a1b2c3d4e5f6a7b8c9d0/0/0/1715769600",
      "notification_url": "https://api.example.com/api/v1/webhooks/cloudinary/upload-complete",
      "resource_type": "video"
    }
  }
}
```

**Client upload:** Send a `multipart/form-data` PUT/POST to `uploadUrl` including all `fields` plus the video file under the key `file`.

---

### GET /api/v1/courses/:courseId/chapters/:chapterIndex/lessons/:lessonIndex/video-status

**Purpose:** Poll for video upload completion after the Cloudinary webhook has fired.

**Authentication:** Session required. Admin or course owner only.

#### Example Request

```bash
curl -X GET "https://api.example.com/api/v1/courses/6650a1b2c3d4e5f6a7b8c9d0/chapters/0/lessons/0/video-status" \
  -H "Cookie: better-auth.session_token=<token>"
```

#### Response `200`

```json
{
  "success": true,
  "message": "Video status fetched",
  "data": {
    "courseId": "6650a1b2c3d4e5f6a7b8c9d0",
    "chapterIndex": 0,
    "lessonIndex": 0,
    "videoReady": true,
    "cloudinaryId": "course-videos/6650a1b2c3d4e5f6a7b8c9d0/0/0/1715769600",
    "durationSeconds": 900,
    "subtitleStatus": "pending"
  }
}
```

`videoReady = true` when `lesson.videos[0].cloudinaryId` is populated (i.e., the webhook has fired and persisted the video).

`subtitleStatus` values: `pending` | `done` | `failed` | `null`

---

### Webhook: POST /api/v1/webhooks/cloudinary/upload-complete

**Purpose:** Cloudinary fires this callback when a direct upload finishes.

**Authentication:** HMAC-SHA1 signature verified via `x-cld-signature` + `x-cld-timestamp` headers using `cloudinary.utils.verifyNotificationSignature`. Returns `401` on failure.

**Routing by `public_id` prefix:**

| Prefix | Handler |
|---|---|
| `course-videos/` | Updates chapter lesson video, enqueues `CourseSubtitleJob` |
| `short-videos/` | Short video handler (separate domain) |

**`public_id` format for courses:** `course-videos/{courseId}/{chapterIndex}/{lessonIndex}/{timestamp}`

**Subtitle enqueue delay:** `not_before = now + 2 minutes` — allows Cloudinary transcoding to complete before the caption worker picks up the job.

> Always returns `200` to Cloudinary regardless of processing errors to prevent retries.

---

## 7. Security Considerations

### Input Validation

- All MongoDB ID parameters validated with `mongoose.Types.ObjectId.isValid()` before queries.
- Numeric indexes cast via `Number()` and validated with `Number.isInteger()` + non-negative check.
- Enum fields (`status`, `accessLevel`, `visibility`) validated against explicit allowlists before assignment.
- Tag slugs resolved against the database — unknown slugs are rejected or silently dropped depending on context.

### File Upload Security

- Thumbnail upload validates `file.mimetype.startsWith("image/")` before streaming to Cloudinary.
- Resource uploads use `resource_type: "auto"` — Cloudinary determines type from file content.
- Per-file size enforced server-side before upload (`MAX_RESOURCE_SIZE_BYTES = 2 GB`, thumbnail `100 MB`).

### Webhook Integrity

- Cloudinary webhook payloads verified via HMAC-SHA1 before any database writes.
- Raw request body preserved (`req.rawBody`) prior to `express.json()` parsing to ensure signature verification uses the exact signed bytes.

### Least-Privilege Enforcement

- `user` role is blocked from `GET /courses` (management list) via `courseVideoStatus:view` permission.
- `user` role reads on `GET /courses/:id` are gated by `visibility: "all"` AND `accountType`-tier `accessLevel` match.
- Status transition to `published` requires admin; trainer/trainee can only move to `draft` or `pending`.
- `deleteCloudinaryVideo` restricted to admin and trainer via direct role check (not permission system).
- `updateCourseVideo` (legacy PATCH) has no `userHasPermission` check — relies on ownership gate. Consider adding in future.

### Rate Limiting

All POST, PATCH, PUT, DELETE routes are protected by `writeLimiter`. GET routes are unrestricted at the middleware level.

---

## 8. Performance & Observability

### Time Complexity Hotspots

| Endpoint | Concern |
|---|---|
| `GET /courses/completed` | Fetches ALL matching published courses into memory before computing completion. Will degrade at scale. Convert to an aggregation pipeline with `$lookup` + `$group`. |
| `GET /courses/saved-course` | Same in-memory pattern. |
| `GET /courses/:id/progress` | O(chapters × lessons) progress merge + O(quizResponses) answer merge. Bounded by course size — acceptable for typical course scales. |
| `POST /courses/:id/resources/upload` | All files uploaded in parallel via `Promise.all`. CPU/memory bounded by the 20-file `multer` limit. |
| `recomputeCourseStats` | O(chapters × lessons × videos) — runs synchronously on every mutating save. For courses with many chapters, consider offloading to a post-save hook. |

### Cloudinary Asset Cleanup Strategy

| Operation | Behavior |
|---|---|
| `DELETE /courses/:id` | Sequential destroy of all videos, thumbnail, resources; then folder prefix delete. |
| `DELETE /courses/:id/thumbnail` | Destroys by `thumbnailCloudinaryId`. |
| `PATCH /courses/:id` (file thumbnail) | Destroys old thumbnail before uploading new one. |
| `PATCH /courses/:id` (clear thumbnailUrl) | Destroys Cloudinary asset if `thumbnailCloudinaryId` exists. |
| `DELETE .../chapters/:idx` | Sequential destroy of all videos in that chapter. |
| `DELETE .../lessons/:idx` | Sequential destroy of all videos in that lesson. |
| `DELETE .../videos/:idx` | Single video destroy. |
| `DELETE .../resources/:idx` | Single resource destroy with MIME-based `resource_type` detection. |

All Cloudinary errors are logged at `warn`/`error` level and are **non-fatal** — the database operation proceeds even if Cloudinary cleanup fails.

### Subtitle Pipeline

- `CourseSubtitleJob` has a compound unique index on `(courseId, cloudinaryId)` — prevents duplicate jobs.
- `enqueueCourseSubtitleJobs` uses `bulkWrite` with `upsert: true` for idempotent job creation.
- First attempt is delayed by 2 minutes (`not_before`) to allow Cloudinary transcoding to complete.
- `subtitle_status` values: `pending` → `done` | `failed`. Failed jobs set `retryable: true` and can be re-queued via `POST /courses/:courseId/retry-subtitles`.

### Observability

Structured logs emitted via the `logger` utility:

| Log prefix | When |
|---|---|
| `[CourseSubtitles]` | Subtitle job enqueue events — includes course ID and job count |
| `[CourseVideosV1]` | Signed URL generation — includes course/chapter/lesson |
| `[CloudinaryUploadV1]` | Webhook receive, routing decision, course update, subtitle enqueue |
| `Cloudinary deletion failed` | Any failed Cloudinary `destroy` call (warn level) |
| `Error sending notification` | Failed FCM/Expo push (error level, non-fatal) |

All unhandled errors are forwarded to Express error middleware via `next(error)`.
