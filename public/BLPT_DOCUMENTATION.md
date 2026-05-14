# BLPT Backend — Technical Documentation

> **Beyond Limits Platform Training (BLPT)**
> Node.js / Express / TypeScript / MongoDB (Mongoose) / Better Auth

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Environment Variables](#4-environment-variables)
5. [Server Bootstrap](#5-server-bootstrap)
6. [Authentication](#6-authentication)
7. [API Response Shape](#7-api-response-shape)
8. [Rate Limiting](#8-rate-limiting)
9. [Account Management APIs](#9-account-management-apis)
10. [Admin APIs](#10-admin-apis)
11. [Profile APIs](#11-profile-apis)
12. [Short Videos APIs](#12-short-videos-apis)
13. [Short Videos V1 (Two-Phase Upload)](#13-short-videos-v1-two-phase-upload)
14. [Course APIs](#14-course-apis)
15. [Course Videos V1 (Two-Phase Upload)](#15-course-videos-v1-two-phase-upload)
16. [Popular Courses API](#16-popular-courses-api)
17. [Assign Shorts APIs](#17-assign-shorts-apis)
18. [Assign Course APIs](#18-assign-course-apis)
19. [Clinical Assignment APIs](#19-clinical-assignment-apis)
20. [Notifications APIs](#20-notifications-apis)
21. [Device Token APIs](#21-device-token-apis)
22. [Support Ticket APIs](#22-support-ticket-apis)
23. [Tags APIs](#23-tags-apis)
24. [Webhooks](#24-webhooks)
25. [Background Workers & Cron Jobs](#25-background-workers--cron-jobs)
26. [Database Migrations](#26-database-migrations)
27. [Utilities Reference](#27-utilities-reference)

---

## 1. Project Overview

BLPT Backend is a RESTful API server for the **Beyond Limits Learning Hub** platform — a multi-role learning management system (LMS) supporting:

- **Short video** and **structured course** content delivery
- Role-based access: `super-admin`, `admin`, `trainer`, `trainee`, `user`
- Per-user **profiles** (similar to Netflix profiles) for Individual Learner accounts
- **Subtitle auto-generation** via Cloudinary + Google Speech
- **Push notifications** via Firebase Cloud Messaging (FCM)
- **Support tickets** with Slack integration
- **Clinical assignments** — linking trainees to clinical supervisors

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ESM-compatible via `ts-node` / compiled JS) |
| Framework | Express.js |
| Language | TypeScript |
| Database | MongoDB via Mongoose |
| Authentication | Better Auth (email/password + OTP) |
| File Storage | Cloudinary (videos, images, resources) |
| Push Notifications | Firebase Admin SDK (FCM) |
| Email | Mailchimp Transactional (Mandrill) |
| Logging | Winston |
| Task Scheduling | node-cron |
| File Upload (server-side) | Multer (memory storage) |

---

## 3. Project Structure

```
src/
├── app.ts                  # Express app — middleware, routes, error handler
├── index.ts                # Server entry point — listen, DB connect, workers
├── config/
│   ├── cloudinary.ts       # Cloudinary SDK + multer-storage-cloudinary
│   ├── database.ts         # Mongoose connect + graceful shutdown
│   ├── email-service.ts    # Email transport config
│   └── firebase.ts         # Firebase Admin SDK init
├── controllers/            # Request handlers (one folder per domain)
├── routes/                 # Express routers (one folder per domain)
├── models/                 # Mongoose schemas & models
├── services/
│   ├── popular-course.ts   # Popularity score computation
│   └── visibility.ts       # Content visibility helpers
├── utils/
│   ├── api-response.ts     # sendSuccess / sendError helpers
│   ├── cloudinary-helpers.ts
│   ├── logger.ts           # Winston logger
│   ├── mailer.ts           # Email send helpers
│   ├── mailchimp.ts        # Mailchimp list sync
│   ├── mongodb.ts          # ObjectId helpers
│   ├── multer.ts           # Memory-storage multer for resources
│   ├── rate-limiter.ts     # writeLimiter / strictLimiter
│   ├── roles.ts            # isRoleIn() helper
│   ├── runMigrations.ts    # Schema migration runner
│   ├── string.ts           # String utilities
│   └── tags.ts             # Tag slug helpers
├── workers/
│   └── captionWorker.ts    # Subtitle polling worker
└── types/                  # Shared TypeScript types
```

---

## 4. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP port (default: `5000`) |
| `MONGO_URI` | ✅ | MongoDB connection string |
| `NODE_ENV` | No | `production` or `development` |
| `CLIENT_ORIGIN1` | ✅ | Primary frontend origin for CORS |
| `CLIENT_ORIGIN2` | ✅ | Secondary frontend origin for CORS |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary API secret |
| `CLOUDINARY_WEBHOOK_SECRET` | ✅ | For verifying Cloudinary webhook signatures |
| `FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | ✅ | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | ✅ | Firebase private key (PEM) |
| `BETTER_AUTH_SECRET` | ✅ | Better Auth session signing secret |
| `BETTER_AUTH_URL` | ✅ | Base URL of this backend |
| `SLACK_BOT_TOKEN` | No | Slack Bot OAuth token for support integration |
| `SLACK_SIGNING_SECRET` | No | Slack signing secret for webhook verification |
| `LOG_LEVEL` | No | Winston log level (default: `info` in prod, `debug` in dev) |

---

## 5. Server Bootstrap

**Entry point:** `src/index.ts`

Startup sequence on `app.listen`:
1. `connectDB()` — connect to MongoDB; runs `runMigrations()` on success
2. `ensureDefaultTicketType()` — seeds the "App Technical Support" ticket type if missing
3. `startCaptionWorker()` — starts the 60-second subtitle polling loop
4. `recomputePopularCoursesAllService()` — immediate popularity score computation on boot
5. **cron** `0 0 * * *` — recomputes popular courses daily at midnight

**CORS** — credentials allowed from `CLIENT_ORIGIN1`, `CLIENT_ORIGIN2`, `localhost:5173`, `127.0.0.1:5173`, and the Vercel frontend.

**DNS override** — `dns.setServers(['8.8.8.8', '1.1.1.1'])` fixes `querySrv ECONNREFUSED` on restrictive ISPs.

---

## 6. Authentication

Handled entirely by **Better Auth** at `/api/auth/*`.

```
POST /api/auth/sign-up/email
POST /api/auth/sign-in/email
POST /api/auth/sign-out
POST /api/auth/email-verification/send-otp
POST /api/auth/email-verification/verify-otp
POST /api/auth/change-password
POST /api/auth/forget-password  (and reset flow)
```

Better Auth manages sessions via HTTP-only cookies (`better-auth.session_token`).

**Roles** (stored on the Better Auth `user` record):
- `super-admin` — full platform access
- `admin` — content moderation, user management
- `trainer` — creates and assigns content
- `trainee` — assigned to trainers; limited content access
- `user` — individual learner; uses profiles

Role checks use the `isRoleIn(role, ...roles)` helper (`src/utils/roles.ts`) which handles both string and array role values returned by Better Auth.

---

## 7. API Response Shape

All custom controllers use the `sendSuccess` / `sendError` helpers.

**Success:**
```json
{
  "success": true,
  "message": "...",
  "data": { ... },
  "meta": { "page": 1, "total": 42 }
}
```

**Error:**
```json
{
  "success": false,
  "message": "...",
  "errors": { ... }
}
```

`data` and `meta` are omitted when not applicable. `errors` is omitted on simple error responses.

---

## 8. Rate Limiting

Two limiters are available (from `src/utils/rate-limiter.ts`):

| Limiter | Window | Max requests | Applied to |
|---|---|---|---|
| `writeLimiter` | 15 min | 30 per IP | All mutation routes (POST, PUT, PATCH, DELETE) |
| `strictLimiter` | 15 min | 10 per IP | Sensitive endpoints (avatar upload, etc.) |

---

## 9. Account Management APIs

**Base prefix:** `/api`

| Method | Path | Description |
|---|---|---|
| `POST` | `/sign-up/email` | Register a new user with email + password |
| `POST` | `/email-otp/send-verification-otp` | Send email verification OTP |
| `POST` | `/verify-email-otp` | Verify email OTP |
| `POST` | `/sign-in/email` | Sign in with email + password |
| `POST` | `/sign-out` | Sign out (clears session cookie) |
| `POST` | `/change-password` | Change password (requires current password) |
| `POST` | `/forget-password/email-otp` | Send forgot-password OTP to email |
| `POST` | `/email-otp/check-verification-otp` | Verify forgot-password OTP |
| `POST` | `/email-otp/reset-password` | Reset password using verified OTP |
| `POST` | `/delete-account` | Delete own account |
| `GET` | `/me` | Get current user session info |
| `POST` | `/update-account-info` | Update name / display info |
| `POST` | `/account/upload-profile-photo` | Upload account avatar (multipart `image`) |
| `DELETE` | `/account/remove-profile-photo` | Remove account avatar from Cloudinary |

**Auth required:** All except `sign-up`, `sign-in`, OTP send/verify, and password reset.

---

## 10. Admin APIs

**Base prefix:** `/api/admin`  
**Auth required:** `super-admin` or `admin` role

### User Management

| Method | Path | Description |
|---|---|---|
| `POST` | `/admin/create-user` | Create a user with a specific role |
| `GET` | `/admin/list-user/all` | Paginated user list (cursor-based) |
| `GET` | `/admin/list-user` | User list (legacy, no cursor) |
| `POST` | `/admin/set-user-role` | Change a user's role |
| `POST` | `/admin/reset-user-password` | Admin-reset a user's password |
| `POST` | `/admin/ban-user` | Ban a user account |
| `POST` | `/admin/unban-user` | Unban a user account |
| `POST` | `/admin/delete-user` | Delete a single user |
| `POST` | `/admin/delete-users` | Bulk delete users |
| `POST` | `/admin/update-user` | Update user data |

### Profile Management (Admin)

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/profiles` | List all profiles across all users |
| `POST` | `/admin/profiles` | Create a profile for any user |
| `PATCH` | `/admin/profiles/:profileId` | Update any profile |
| `DELETE` | `/admin/profiles/:profileId` | Delete any profile |
| `GET` | `/admin/user-profiles` | List profiles for a specific user |

---

## 11. Profile APIs

**Base prefix:** `/api`  
**Auth required:** Authenticated user (session cookie)

Profiles are sub-accounts within a single user account (Individual Learner role).

| Method | Path | Rate Limit | Description |
|---|---|---|---|
| `GET` | `/profiles` | — | List own profiles |
| `POST` | `/profiles` | `writeLimiter` | Create a new profile (multipart `image` optional) |
| `PATCH` | `/profiles/:profileId` | `writeLimiter` | Update a profile (name, avatar) |
| `DELETE` | `/profiles/:profileId` | `writeLimiter` | Delete a profile |
| `POST` | `/profiles/switch` | `writeLimiter` | Switch active profile |
| `POST` | `/profiles/:profileId/avatar` | `strictLimiter` | Upload profile avatar (multipart `image`) |
| `DELETE` | `/profiles/:profileId/avatar` | `writeLimiter` | Remove profile avatar |

**One default profile** per user is enforced via a partial unique index `{ userId, isDefault: true }`.

---

## 12. Short Videos APIs

**Base prefix:** `/api`  
**Auth required:** Session cookie

Short videos are single-file video assets with optional subtitles, resources, and tags.

### Listing & Retrieval

| Method | Path | Description |
|---|---|---|
| `GET` | `/short-videos` | List all short videos (management view — all statuses) |
| `GET` | `/short-videos/published-videos` | List published short videos (consumer view) |
| `GET` | `/short-videos/:id` | Get a single short video by ID |

### Progress Tracking

| Method | Path | Description |
|---|---|---|
| `GET` | `/short-videos/:id/progress` | Get watch progress for a short video |
| `POST` | `/short-videos/:id/progress` | Update watch progress (`watchedSeconds`, `completed`) |

### Content Management

| Method | Path | Description |
|---|---|---|
| `POST` | `/short-videos` | Create a short video (legacy direct upload) |
| `PUT` | `/short-videos/:id` | Update short video metadata |
| `DELETE` | `/short-videos/:id` | Delete a short video |
| `DELETE` | `/short-videos/:id/video` | Remove the video file from Cloudinary |
| `POST` | `/short-videos/:id/thumbnail` | Upload thumbnail (multipart `thumbnail`) |

### Resources

| Method | Path | Description |
|---|---|---|
| `POST` | `/short-videos/:id/resources` | Attach resource files (PDF, DOCX, images — max 10) |
| `DELETE` | `/short-videos/:id/resources/:resourceId` | Remove a resource by ID |

### Admin

| Method | Path | Description |
|---|---|---|
| `PUT` | `/admin/change-status-short-video/:id` | Change video status (`draft`, `pending`, `published`, `rejected`) |

### Subtitle Retry

| Method | Path | Description |
|---|---|---|
| `POST` | `/short-videos/:id/retry-subtitles` | Manually re-trigger subtitle generation |

**Status lifecycle:** `draft` → `pending` → `published` / `rejected`

**Access levels:** `free`, `develop`, `master`

**Visibility:** `users`, `clinicians`, `all`

---

## 13. Short Videos V1 (Two-Phase Upload)

**Base prefix:** `/api/v1`

The V1 flow avoids sending the video through the backend server. Instead, the client uploads directly to Cloudinary using a signed URL.

**Flow:**
```
1. POST /v1/short-videos              → Create shell doc (no video yet)
2. POST /v1/short-videos/:id/signed-upload-url → Get Cloudinary signed upload URL
3. Client uploads video directly to Cloudinary
4. Cloudinary fires → POST /v1/webhooks/cloudinary/upload-complete
5. POST /v1/short-videos/:id/publish  → Mark video as ready + enqueue subtitle job
```

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/short-videos` | Create empty short video shell |
| `POST` | `/v1/short-videos/:id/signed-upload-url` | Get a Cloudinary signed upload URL |
| `GET` | `/v1/short-videos/:id/status` | Poll upload/processing status |
| `POST` | `/v1/short-videos/:id/publish` | Publish after Cloudinary confirms upload |
| `POST` | `/v1/short-videos/:id/thumbnail` | Upload thumbnail (multipart `thumbnail`) |

---

## 14. Course APIs

**Base prefix:** `/api`  
**Auth required:** Session cookie

Courses are structured as: **Course → Chapters → Lessons → Videos** (all embedded documents).

### Listing & Retrieval

| Method | Path | Description |
|---|---|---|
| `GET` | `/courses` | All courses (management / admin view) |
| `GET` | `/courses/published-videos` | Published courses for the current user |
| `GET` | `/courses/completed` | Courses the current user has completed |
| `GET` | `/courses/saved-course` | Courses saved/bookmarked by the current user |
| `GET` | `/courses/popular-all` | Popular courses sorted by score |
| `GET` | `/courses/:id` | Get single course by ID |
| `GET` | `/courses/:id/progress` | Course with per-lesson progress for current user |

### Course CRUD

| Method | Path | Description |
|---|---|---|
| `POST` | `/courses` | Create course (multipart `thumbnail` optional) |
| `PATCH` | `/courses/:id` | Update course metadata (multipart `thumbnail` optional) |
| `DELETE` | `/courses/:id` | Delete course + all Cloudinary assets |
| `DELETE` | `/courses/:id/thumbnail` | Remove course thumbnail |
| `POST` | `/courses/:id/save` | Save/unsave a course (toggle bookmark) |

### Resources

| Method | Path | Description |
|---|---|---|
| `POST` | `/courses/:id/resources/upload` | Upload course resource files (max 20, multipart `files`) |
| `DELETE` | `/courses/:id/resources/:resourceIndex` | Remove a resource by index |

### Chapter Management

| Method | Path | Description |
|---|---|---|
| `POST` | `/courses/:courseId/chapters` | Add a chapter |
| `DELETE` | `/courses/:courseId/chapters/:chapterIndex` | Delete a chapter |

### Lesson Management

| Method | Path | Description |
|---|---|---|
| `POST` | `/courses/:courseId/chapters/:chapterIndex/lessons` | Add a lesson to a chapter |
| `DELETE` | `/courses/:courseId/chapters/:chapterIndex/lessons/:lessonIndex` | Delete a lesson |
| `PATCH` | `/courses/:courseId/chapters/:chapterIndex/lessons/:lessonIndex/video` | Update video metadata on a lesson |
| `DELETE` | `/courses/:courseId/chapters/:chapterIndex/lessons/:lessonIndex/videos/:videoIndex` | Remove a video from a lesson |

### Progress & Quiz

| Method | Path | Description |
|---|---|---|
| `PUT` | `/courses/:courseId/chapters/:chapterId/lessons/progress` | Update lesson watch progress |
| `POST` | `/courses/:courseId/chapters/:chapterId/quiz/responses` | Submit quiz answers |

### Quiz Management

| Method | Path | Description |
|---|---|---|
| `POST` | `/courses/:courseId/chapters/:chapterIndex/quizzes` | Add a quiz to a chapter |
| `DELETE` | `/courses/:courseId/chapters/:chapterIndex/quizzes/:quizIndex` | Delete a quiz |

### Admin & Utility

| Method | Path | Description |
|---|---|---|
| `PUT` | `/admin/change-status-course/:id` | Change course status (`draft` → `pending` → `published` / `rejected`) |
| `POST` | `/courses/videos-upload` | Upload a lesson video directly to Cloudinary (legacy) |
| `POST` | `/courses/delete-cloudinary-video` | Delete a video asset from Cloudinary |
| `POST` | `/courses/:courseId/retry-subtitles` | Retry subtitle generation for all failed videos in a course |

**Status lifecycle:** `draft` → `pending` → `published` / `rejected`

---

## 15. Course Videos V1 (Two-Phase Upload)

**Base prefix:** `/api/v1`

Direct-to-Cloudinary upload flow for course lesson videos.

```
1. POST /v1/courses/:courseId/chapters/:chapterIndex/lessons/:lessonIndex/signed-upload-url
   → Returns a Cloudinary signed upload URL
2. Client uploads video directly to Cloudinary
3. Cloudinary fires → POST /v1/webhooks/cloudinary/upload-complete
   → Backend links the video to the lesson + enqueues subtitle job
4. GET /v1/courses/:courseId/chapters/:chapterIndex/lessons/:lessonIndex/video-status
   → Poll until video is linked and subtitle job is enqueued
```

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/courses/:courseId/chapters/:chapterIndex/lessons/:lessonIndex/signed-upload-url` | Generate Cloudinary signed upload URL for a lesson video |
| `GET` | `/v1/courses/:courseId/chapters/:chapterIndex/lessons/:lessonIndex/video-status` | Poll upload + subtitle enqueue status |

---

## 16. Popular Courses API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/courses/popular-all` | Return courses ordered by computed popularity score |

**Score computation** runs:
- On server startup (immediate, non-blocking)
- Daily at midnight (`cron: 0 0 * * *`)
- Via `recomputePopularCoursesAllService()` in `src/services/popular-course.ts`

Score factors: `savedCount`, `uniqueWatchers`, `totalWatchedSeconds`, `completionCount`.

---

## 17. Assign Shorts APIs

**Base prefix:** `/api`  
**Auth required:** Session cookie  
**Rate limit:** `writeLimiter` on mutations

Assigns short videos to users. Supports individual and bulk operations.

| Method | Path | Description |
|---|---|---|
| `POST` | `/assign-shorts` | Assign a short video to a user |
| `POST` | `/assign-shorts/bulk` | Assign multiple short videos at once |
| `DELETE` | `/assign-shorts` | Remove a short video assignment |
| `DELETE` | `/assign-shorts/bulk` | Remove multiple assignments at once |
| `GET` | `/assign-shorts/me` | List short videos assigned to me |
| `GET` | `/assign-shorts/assigned-by-me` | List short videos I have assigned to others |
| `GET` | `/assign-shorts/assignees/:userId` | List short videos assigned to a specific user |

**Uniqueness key:** `(assignedToId, shortVideoId, assignedByRole, profileId)` — allows assigning the same video to different profiles of the same user.

---

## 18. Assign Course APIs

**Base prefix:** `/api`  
**Auth required:** Session cookie  
**Rate limit:** `writeLimiter` on mutations

| Method | Path | Description |
|---|---|---|
| `POST` | `/assign-course` | Assign a course to a user |
| `POST` | `/assign-course/bulk` | Assign multiple courses at once |
| `DELETE` | `/assign-course` | Remove a course assignment |
| `DELETE` | `/assign-course/bulk` | Remove multiple course assignments |
| `GET` | `/assign-course/me` | List courses assigned to me |
| `GET` | `/assign-course/assigned-by-me` | List courses I have assigned to others |
| `GET` | `/assign-course/assignees/:userId` | List courses assigned to a specific user |

**Uniqueness key:** `(assignedToId, courseId, assignedByRole, profileId)`

---

## 19. Clinical Assignment APIs

**Base prefix:** `/api`  
**Auth required:** Session cookie  
**Rate limit:** `writeLimiter` on mutations

Clinical assignments link a learner's profile to clinical supervisors (trainers/trainees). One document per `(userId, profileId)` pair; max 5 clinicians per document.

| Method | Path | Description |
|---|---|---|
| `POST` | `/assign-clinical/assign` | Assign a clinician to a user/profile |
| `DELETE` | `/assign-clinical/assign` | Remove a clinician from a user/profile |
| `GET` | `/assign-clinical/:userId` | Get all clinicians assigned to a user |
| `GET` | `/assign-clinical/trainee/:traineeId` | Get all users assigned to a specific trainee/clinician |

---

## 20. Notifications APIs

**Base prefix:** `/api`  
**Auth required:** Session cookie

In-app notifications auto-expire after **30 days** (MongoDB TTL index).

| Method | Path | Description |
|---|---|---|
| `GET` | `/notifications` | List notifications for the current user |
| `POST` | `/notifications/:id/read` | Mark a notification as read |
| `DELETE` | `/notifications` | Clear all notifications for the current user |
| `DELETE` | `/notifications/:id` | Delete a single notification |

---

## 21. Device Token APIs

**Base prefix:** `/api`  
**Auth required:** Session cookie

FCM device tokens for push notifications. One token per user (upsert on register).

| Method | Path | Description |
|---|---|---|
| `POST` | `/notifications/tokens-register` | Register a device token (`deviceToken`, `deviceType`: `ios`/`android`/`web`) |
| `POST` | `/notifications/tokens-deregister` | Remove the device token for the current user |
| `POST` | `/notifications/device-tokens/test` | Send a test push notification to the current user |

---

## 22. Support Ticket APIs

**Base prefix:** `/api`  
**Auth required:** Session cookie  
**Rate limit:** `writeLimiter` on mutations

Supports image (up to 10) and video (up to 3) attachments via Cloudinary. Resolved tickets are auto-purged via MongoDB TTL on `expireAt`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/support/tickets` | Create a ticket (multipart: `images[]`, `videos[]`) |
| `GET` | `/support/tickets` | List all tickets (admin view) |
| `GET` | `/support/tickets/app-technical-support` | List App Technical Support tickets |
| `GET` | `/support/ticket-types` | Get all ticket type categories |
| `GET` | `/support/tickets/:id` | Get a single ticket |
| `POST` | `/support/tickets/:id/resolve` | Resolve a ticket (sets `expireAt` to trigger TTL purge) |
| `POST` | `/support/create-ticket-type` | Create a new ticket type category |
| `DELETE` | `/support/delete-ticket-type/:id` | Delete a ticket type |
| `POST` | `/support/slack-interact` | Slack interactive component callback (for Slack-side resolve actions) |

**Ticket status:** `pending` → `resolved`

**Default ticket type** (`app-technical-support`) is seeded automatically on server startup.

---

## 23. Tags APIs

**Base prefix:** `/api/admin`  
**Auth required:** Admin role  
**Rate limit:** `writeLimiter` on mutations

Tags are used to categorise courses and short videos. Soft-deleted tags expire from the database after ~180 days via TTL.

| Method | Path | Description |
|---|---|---|
| `POST` | `/admin/create-tags` | Create a new tag |
| `GET` | `/admin/tags` | List all tags |
| `PUT` | `/admin/tags/:id/deactivate` | Deactivate a tag (hides from content selection) |
| `PUT` | `/admin/tags/:id/activate` | Reactivate a tag |
| `DELETE` | `/admin/tags/:id` | Soft-delete a tag (sets `deletedAt`; TTL removes after 180 days) |

---

## 24. Webhooks

### Cloudinary Subtitle Webhook

```
POST /api/webhooks/cloudinary/blpt-videos
```

Called by Cloudinary when Google Speech transcription is complete for a short video.

- Verifies the Cloudinary webhook signature using `CLOUDINARY_WEBHOOK_SECRET`
- Finds the `ShortVideo` by `public_id` (cloudinaryId)
- If `google_speech` asset is present: saves the VTT URL to `subtitles[]`, sets `subtitle_status: "completed"`
- If transcription failed: sets `subtitle_status: "failed"` with reason

### Cloudinary Upload Complete V1 Webhook

```
POST /api/v1/webhooks/cloudinary/upload-complete
```

Called by Cloudinary when a direct-upload video finishes processing (V1 two-phase flow).

- Identifies whether the upload is for a **short video** or **course lesson video** from Cloudinary metadata tags
- Updates the corresponding document with `cloudinaryUrl`, `cloudinaryId`, `durationSeconds`
- Enqueues a subtitle job in `course-subtitle-jobs` (courses) or sets `subtitle_status: "pending"` (short videos)

---

## 25. Background Workers & Cron Jobs

### Caption Worker (`src/workers/captionWorker.ts`)

A MongoDB-backed polling worker that triggers Cloudinary Google Speech transcription.

- **Poll interval:** 60 seconds
- **Queues:** `short-videos` (by `subtitle_status`) and `course-subtitle-jobs` collection
- **Startup:** Resets stale `processing` jobs (stuck > 10 minutes) back to `pending`

**Job lifecycle:**

```
not_before elapsed?
  No  → skip (upload-processing delay guard)
  Yes → set status = "processing", increment retry_count
        → call Cloudinary raw_convert: "google_speech:vtt"
        → success: Cloudinary fires webhook → status = "completed"
        → failure: status = "failed", retryable = true/false
```

**Stale reset threshold:** 10 minutes — prevents jobs stuck in `processing` from blocking the queue after a crash.

### Popular Courses Cron

Scheduled via `node-cron` in `src/index.ts`:

```
Schedule: 0 0 * * *   (daily at midnight)
Service:  recomputePopularCoursesAllService()
```

Aggregates watch progress, saves, and completion counts into `CoursePopularity` collection.

---

## 26. Database Migrations

**File:** `src/utils/runMigrations.ts`

A startup migration runner that applies idempotent schema migrations. Runs automatically after `mongoose.connect()` in `src/config/database.ts`.

Each migration has:
- `id` — unique identifier (e.g. `001-short-assignments-add-profileId-to-unique-index`)
- `description` — human-readable explanation
- `run()` — async function with `dropIndexIfExists` + `ensureIndexExists` helpers

**Current migrations:**

| ID | Description |
|---|---|
| `001` | Drops old `short-assignments` unique index (missing `profileId`), recreates with 4-field key |
| `002` | Drops old `course-assignments` unique index (missing `profileId`), recreates with 4-field key |

**Safety:** `dropIndexIfExists` silently ignores `IndexNotFound` errors. `ensureIndexExists` is a no-op if the index already exists. Safe to run on every startup.

**Adding a new migration:** Append an object to the `migrations` array in `runMigrations.ts`.

---

## 27. Utilities Reference

### `src/utils/api-response.ts`

| Function | Signature | Description |
|---|---|---|
| `sendSuccess` | `(res, statusCode, message, data?, meta?)` | Sends `{ success: true, message, data?, meta? }` |
| `sendError` | `(res, statusCode, message, errors?)` | Sends `{ success: false, message, errors? }` |

### `src/utils/roles.ts`

```ts
isRoleIn(role: unknown, ...roles: string[]): boolean
```
Returns `true` if `role` matches any of the provided role names. Handles both `string` and `string[]` (Better Auth may return either).

### `src/utils/rate-limiter.ts`

| Export | Window | Max | Use case |
|---|---|---|---|
| `writeLimiter` | 15 min | 30/IP | Standard mutation endpoints |
| `strictLimiter` | 15 min | 10/IP | Sensitive endpoints (avatar, etc.) |

### `src/utils/multer.ts`

**`resourceUpload`** — memory-storage multer for server-side resource file handling.

- Max file size: **10 MB**
- Max files: **10**
- Allowed MIME types: `application/pdf`, `application/msword`, `.docx`, `image/jpeg`, `image/png`, `image/webp`

### `src/utils/logger.ts`

Winston logger. Outputs:
- **Development:** coloured, human-readable console logs
- **Production:** structured JSON console logs

Log level: `LOG_LEVEL` env var (defaults to `info` in production, `debug` in development).

### `src/config/cloudinary.ts`

Cloudinary SDK instance + `multer-storage-cloudinary` upload middleware (`upload`). Used for images (thumbnails, avatars, support ticket attachments). Video uploads use the V1 signed-URL flow.

### `src/config/firebase.ts`

Firebase Admin SDK initialized with service account credentials. Used by `device-tokens` controller to send FCM push notifications.

---

## See Also

- [`public/documentation/DATABASEmd`](./documentation/DATABASEmd) — Full MongoDB schema reference for all 18 collections
- [`public/documentation/SHORTS.md`](./documentation/SHORTS.md) — Short videos feature deep-dive
- [`public/documentation/COURSE.md`](./documentation/COURSE.md) — Course feature deep-dive
- [`public/documentation/ASSIGN_SHORTS.md`](./documentation/ASSIGN_SHORTS.md) — Assignment system details
- [`public/documentation/ASSIGN_COURSE.md`](./documentation/ASSIGN_COURSE.md) — Course assignment system details
- [`public/documentation/ASSIGN_CLINICAL.md`](./documentation/ASSIGN_CLINICAL.md) — Clinical assignment system
- [`public/documentation/SUPPORT.md`](./documentation/SUPPORT.md) — Support ticket system
- [`public/documentation/TAG.md`](./documentation/TAG.md) — Tag management
- [`public/documentation/PROFILE.md`](./documentation/PROFILE.md) — Profile system
- [`public/documentation/ACCOUNT.md`](./documentation/ACCOUNT.md) — Account management
- [`public/documentation/ADMIN.md`](./documentation/ADMIN.md) — Admin operations

