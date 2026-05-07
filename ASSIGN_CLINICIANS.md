# Clinical Assignment API Documentation

## 1. API Overview

**Domain Context:**
The Clinical Assignment API manages the lifecycle of relationships between system users (learners/patients) and clinical personnel (trainers and trainees) within the Beyond Limits Learning Hub. It provides mechanisms to assign, unassign, and query clinical relationships.

**Architectural Style:**
REST-compliant JSON API.

**Versioning Strategy:**
Implicitly v1, integrated directly into the core routing layer.

**Base URL Conventions:**
Routes are mounted at the root level relative to the API gateway (e.g., `https://api.yourdomain.com`).

---

## 2. Role-Based Access Control (RBAC) Model

The API employs a fine-grained, permission-based authorization model leveraging the Better Auth framework. Access is governed by specific permission arrays rather than generic user roles, ensuring the Principle of Least Privilege.

### Enforcement Logic at Request Lifecycle Stages:
1.  **Authentication:** All endpoints require a valid Better Auth session (evaluated via `auth.api.getSession` against incoming Node headers). Missing or invalid sessions yield a `401 Unauthorized`.
2.  **Authorization:** Validated via `auth.api.userHasPermission`. The requesting user must possess explicit capabilities within the `clinicalAssign` resource domain. Failures yield a `403 Forbidden`.
3.  **Resource Ownership:** These endpoints are restricted to `admin` and `trainer` roles via the `clinicalAssign` permission scope. There are no self-ownership checks — the RBAC model enforces global `clinicalAssign` permissions.

### Role Access
| Role | Can Assign | Can Unassign | Can View |
| :--- | :--- | :--- | :--- |
| `admin` | Yes | Yes | Yes |
| `trainer` | Yes | Yes | Yes |
| `trainee` | No | No | No |
| `user` | No | No | No |

### Permissions Matrix
| Endpoint | Method | Required Permission |
| :--- | :--- | :--- |
| `/assign-clinical/assign` | `POST` | `clinicalAssign: ["create"]` |
| `/assign-clinical/assign` | `DELETE` | `clinicalAssign: ["delete"]` |
| `/assign-clinical/:userId` | `GET` | `clinicalAssign: ["view"]` |
| `/assign-clinical/trainee/:traineeId` | `GET` | `clinicalAssign: ["view"]` |

---

## 3. Endpoint-Level Specifications

### 3.1. Assign Clinician to User
**Purpose:** Assigns a new clinical staff member (trainer or trainee) to a user's profile. Updates existing clinician metadata if the assignment already exists.

*   **HTTP Method:** `POST`
*   **Route:** `/assign-clinical/assign`
*   **Authentication:** Required (Better Auth Session)
*   **Required Headers:** `Authorization: Bearer <token>` or valid session cookie. `Content-Type: application/json`.

**Request Schema:**
| Field | Type | Required | Default | Constraints / Validation |
| :--- | :--- | :--- | :--- | :--- |
| `userId` | `string` | **Yes** | - | Must not be empty. Cannot match `clinicianId`. |
| `profileId` | `string` | No | `""` (Empty String) | Identifies specific sub-profiles if applicable. |
| `clinicianRole` | `string` | No | `"trainee"` | Must be exactly `'trainee'` or `'trainer'`. |
| `clinicianId` | `string` | **Yes*** | - | Fallbacks to `traineeId` if omitted. If omitted entirely, endpoint returns existing assignments without changes. |
| `clinicianEmail` | `string` | **Yes** | - | Fallbacks to `traineeEmail`. Must not be empty. |
| `clinicianName` | `string` | **Yes** | - | Fallbacks to `traineeName`. Must not be empty. |

**Validation & Business Logic Flow:**
1.  **Preconditions Check:** Validates presence of `userId`, ensures `clinicianId !== userId` (no self-assignment).
2.  **Capacity Constraint:** Validates that the user does not exceed the maximum of 5 clinicians per profile.
3.  **Idempotency & Upsert:**
    *   If the clinician is *already assigned* (matching ID and Role), their `clinicianEmail` and `clinicianName` are updated in place.
    *   If not assigned, a new record is pushed to the `clinicians` array. The parent `ClinicalAssignment` document is created via upsert if it doesn't exist.
4.  **Side Effects:** Dispatches a push notification to the user (`clinician-assigned` event) and logs a persistent `Notification` document.

**Request Example:**
```json
{
  "userId": "usr_12345",
  "clinicianRole": "trainer",
  "clinicianId": "cln_98765",
  "clinicianEmail": "trainer@beyondlimits.edu",
  "clinicianName": "Dr. Sarah Jenkins"
}
```

**Response Example (200 OK - Success):**
```json
{
  "status": "success",
  "message": "Clinician assignment updated",
  "data": {
    "_id": "64abcdef1234567890",
    "userId": "usr_12345",
    "profileId": "",
    "clinicians": [
      {
        "clinicianId": "cln_98765",
        "clinicianRole": "trainer",
        "clinicianEmail": "trainer@beyondlimits.edu",
        "clinicianName": "Dr. Sarah Jenkins"
      }
    ]
  }
}
```

### 3.2. Unassign Clinician from User
**Purpose:** Removes a clinical staff member from a user's profile.

*   **HTTP Method:** `DELETE`
*   **Route:** `/assign-clinical/assign`
*   **Authentication:** Required (Better Auth Session)
*   **Required Headers:** `Content-Type: application/json`.

**Request Schema:**
| Field | Type | Required | Default | Constraints / Validation |
| :--- | :--- | :--- | :--- | :--- |
| `userId` | `string` | **Yes** | - | Must not be empty. |
| `profileId` | `string` | No | `""` | - |
| `clinicianId` | `string` | Conditional | - | Required if the user has multiple clinicians assigned. |
| `clinicianRole` | `string` | Conditional | - | Must be `'trainee'` or `'trainer'`. Required if multiple clinicians assigned. |

**Validation & Business Logic Flow:**
1.  **Conditional Deletion Rule:** If `clinicianId` and `clinicianRole` are omitted, the operation is only permitted if the user has *exactly one* clinician assigned (which will be automatically removed). If multiple clinicians exist and identifiers are omitted, it throws a 400 error.
2.  **Document Update:** Uses MongoDB `$pull` to remove the nested clinician object.
3.  **Side Effects:** Dispatches a push notification (`clinician-unassigned` event) and logs a `Notification`.

**Request Example:**
```json
{
  "userId": "usr_12345",
  "clinicianId": "cln_98765",
  "clinicianRole": "trainer"
}
```

**Response Example (200 OK):**
```json
{
  "status": "success",
  "message": "Clinician unassigned",
  "data": null
}
```

### 3.3. Get Assigned Clinicians for User
**Purpose:** Retrieves all clinicians assigned to a specific user/profile.

*   **HTTP Method:** `GET`
*   **Route:** `/assign-clinical/:userId`
*   **Authentication:** Required (Better Auth Session)

**Path & Query Parameters:**
*   `userId` (Path, **Required**): The ID of the learner.
*   `profileId` (Query, Optional): Profile ID string. Defaults to `""`.

**Response Example (200 OK):**
```json
{
  "status": "success",
  "message": "Clinician assignments fetched",
  "data": {
    "userId": "usr_12345",
    "profileId": "",
    "clinicians": [
      {
        "clinicianId": "cln_98765",
        "clinicianRole": "trainer",
        "clinicianEmail": "trainer@beyondlimits.edu",
        "clinicianName": "Dr. Sarah Jenkins"
      }
    ]
  }
}
```

### 3.4. Get Users Assigned to Trainee
**Purpose:** Retrieves a paginated list of all users/learners currently assigned to a specific trainee.

*   **HTTP Method:** `GET`
*   **Route:** `/assign-clinical/trainee/:traineeId`
*   **Authentication:** Required (Better Auth Session)

**Path & Query Parameters:**
*   `traineeId` (Path, **Required**): The ID of the clinical trainee.
*   `page` (Query, Optional): Page number (1-indexed). Default: `1`.
*   `limit` (Query, Optional): Items per page. Max: `100`. Default: `10`.

**Validation & Business Logic Flow:**
1.  Queries `ClinicalAssignment` where `clinicians` array contains an element matching `clinicianId = traineeId` and `clinicianRole = "trainee"`.
2.  Extracts distinct `userId`s and hydrates user details (Name, Email) by concurrently calling Better Auth's `auth.api.listUsers`.

**Response Example (200 OK):**
```json
{
  "status": "success",
  "message": "Assigned users for trainee fetched",
  "data": [
    {
      "id": "usr_12345",
      "profileId": "",
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "meta": {
    "page": 1,
    "offset": 0,
    "limit": 10,
    "total": 1,
    "hasNext": false
  }
}
```

---

## 4. Standardized Error Handling Model

The API employs a unified error response schema handled via the `sendError` utility.

**Error Payload Schema:**
```json
{
  "status": "error",
  "message": "Human-readable error description"
}
```

**Common HTTP Status Mappings:**
*   `400 Bad Request`: Validation failures (e.g., "userId is required", "Maximum 5 clinicians allowed").
*   `401 Unauthorized`: Missing, invalid, or expired session tokens.
*   `403 Forbidden`: Authenticated user lacks required `clinicalAssign` permissions.
*   `429 Too Many Requests`: Triggered by the `writeLimiter` middleware on `POST` and `DELETE` endpoints to prevent abuse.
*   `500 Internal Server Error`: Unhandled exceptions, database connection failures, or external API (Expo/Firebase) catastrophic failures (though notification errors are heavily swallowed to prevent request failure).

---

## 5. Security Considerations

1.  **Rate Limiting:** `POST` and `DELETE` mutation endpoints are protected by `writeLimiter` to mitigate brute-force and Denial of Service (DoS) attacks on assignment operations.
2.  **Least-Privilege Enforcement:** Permissions are evaluated explicitly per endpoint against the `clinicalAssign` scope. Only `admin` and `trainer` roles hold `clinicalAssign` permissions; `trainee` and `user` roles are denied access.
3.  **Input Sanitization:** String inputs (userId, profileId, clinicianId, etc.) are trimmed (`.trim()`) to prevent whitespace bypass vulnerabilities and ensure clean database keys.
4.  **NoSQL Injection Prevention:** Type checking (`typeof body.userId === "string"`) ensures inputs are scalars, not MongoDB operator objects, mitigating NoSQL injection vectors.
5.  **Fail-Safe Notifications:** The `sendClinicalNotification` function is wrapped in an asynchronous IIFE with swallowed catch blocks (`try {} catch {}`). This guarantees that third-party notification failures (Expo/Firebase) do not break the primary transactional boundary of the assignment.

---

## 6. Pagination, Filtering, and Sorting

*   **Endpoint:** `GET /assign-clinical/trainee/:traineeId` implements cursor-less offset pagination.
*   **Parameters:** `page` (min 1) and `limit` (max 100).
*   **Sorting:** Enforces strict descending chronological sorting (`{ createdAt: -1 }`) on `ClinicalAssignment` queries.
*   **Metadata:** Responses include `page`, `offset`, `limit`, `total` (count of documents), and `hasNext` boolean to simplify frontend state management.

---

## 7. Performance Considerations

1.  **Time Complexity Hotspots:**
    *   The `GET /assign-clinical/trainee/:traineeId` endpoint exhibits an `O(N)` external network overhead where `N` is the number of matching assignments (`limit`). It concurrently dispatches `N` requests to `auth.api.listUsers` via `Promise.all`. While parallelized, large page sizes (`limit=100`) could strain the Better Auth service.
2.  **Database Optimization (Assumed):**
    *   The `ClinicalAssignment` collection heavily requires a compound index on `{ userId: 1, profileId: 1 }` for `POST`/`DELETE`/`GET /:userId` endpoints.
    *   An index on the array elements, specifically `{"clinicians.clinicianId": 1, "clinicians.clinicianRole": 1}`, is critical for the `GET /assign-clinical/trainee/:traineeId` endpoint to avoid collection scans.
3.  **Caching Strategy:** Responses are currently entirely dynamic (real-time). No application-level caching (Redis) is utilized, prioritizing strict consistency over read latency.

---

## 8. Audit Logging and Observability

*   **Traceability:** While explicit application-level audit logging (e.g., `writeAuditLog`) is not strictly present in the provided controller, the creation of persistent `Notification` documents intrinsically functions as a partial audit trail for assignments and unassignments, logging the actor/subject and timestamp.
*   **Metrics:** Relies on generic APM integration at the Express router level.

---

## 9. Assumptions and Constraints

1.  **Data Consistency:** The system assumes that clinician IDs exist in the Better Auth user registry. Foreign key constraints are not enforced at the database level (MongoDB).
2.  **Silent Failures:** Push notification deliveries and Notification document creations are deliberately designed to fail silently so as not to rollback the successful assignment operations.
3.  **Profile Architecture:** The system supports a multi-profile architecture per user via the `profileId` parameter. It assumes an empty string `""` represents the default or primary profile.
4.  **Maximum Assignments:** A hardcoded business rule restricts a user to a maximum of `5` clinicians per profile to prevent unbounded array growth in the MongoDB document.
