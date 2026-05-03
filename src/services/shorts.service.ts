import { apiClient } from '@/lib/api';

// ─── Role terminology (frontend ↔ system) ────────────────────────────────────
// Super Admin  → admin
// Training Admin → trainer
// Clinical Learner → trainee
// Individual Learner → user  (cannot create shorts)

// ─── Core enumerations ────────────────────────────────────────────────────────

/** Lifecycle states for a Short Video. */
export type ShortVideoStatus = 'draft' | 'pending' | 'published' | 'rejected';

/** Subscription tier required to access a Short Video. */
export type AccessLevel = 'free' | 'develop' | 'master';

/** Target-audience visibility setting. */
export type Visibility = 'clinicians' | 'all';

/** Subtitle pipeline processing states. */
export type SubtitleStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ─── Data models ──────────────────────────────────────────────────────────────

/** Minimal creator/author info embedded in Short Video responses. */
export interface ShortVideoUser {
    _id: string;
    name: string;
    email: string;
}

/** A single subtitle track attached to a Short Video. */
export interface ShortVideoSubtitle {
    lang: string;
    label: string;
    url: string;
    format: 'vtt' | 'srt';
    default?: boolean;
}

/** A downloadable/link resource attached to a Short Video.
 *
 * Shape returned by GET /short-videos/:id in the `resources` array.
 * File resources have a Cloudinary-hosted URL; URL resources link externally.
 */
export interface ShortVideoResource {
    _id: string;
    /** Display label for this resource. */
    name: string;
    url: string;
}

/** Full Short Video entity returned by GET /short-videos/:id */
export interface ShortVideo {
    _id: string;
    title: string;
    description: string;
    tags: string[];
    status: ShortVideoStatus;
    rejectReason?: string;
    user: string;
    createdBy: ShortVideoUser;
    cloudinaryUrl: string;
    cloudinaryId: string;
    thumbnailUrl: string;
    accessLevel: AccessLevel;
    visibility: Visibility;
    durationSeconds: number;
    videoReady: boolean;
    subtitles?: ShortVideoSubtitle[];
    resources?: ShortVideoResource[];
    subtitle_status?: SubtitleStatus;
    subtitle_failure_reason?: string | null;
    subtitle_retry_count?: number;
    last_subtitle_attempt?: string | null;
    retryable?: boolean;
    createdAt: string;
    updatedAt: string;
}

/** Lightweight row returned by the paginated list endpoint. */
export interface ShortVideoListItem {
    _id: string;
    title: string;
    description: string;
    tags: string[];
    status: ShortVideoStatus;
    accessLevel: AccessLevel;
    visibility: Visibility;
    createdBy: ShortVideoUser;
    thumbnailUrl: string;
    cloudinaryUrl: string;
    durationSeconds: number;
    videoReady: boolean;
    createdAt: string;
    updatedAt: string;
}

/** Pagination metadata returned by list endpoints. */
export interface PaginationMeta {
    page: number;
    offset: number;
    limit: number;
    total: number;
    totalPages?: number;
    hasNext: boolean;
    hasPrev?: boolean;
}

// ─── Generic API response wrapper ─────────────────────────────────────────────

interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
}

interface PaginatedApiResponse<T> {
    success: boolean;
    message: string;
    data: T[];
    meta: PaginationMeta;
}

// ─── Request payloads ─────────────────────────────────────────────────────────

/**
 * Phase 1 of the V1 upload flow.
 * Creates a `draft` shell with metadata only — no video file yet.
 * The API requires title and description; tags, accessLevel, and visibility
 * are optional at shell creation time.
 *
 * Allowed creators: admin, trainer (Training Admin), trainee (Clinical Learner).
 * Individual Learners (user role) cannot create shorts.
 */
export interface CreateShortShellPayload {
    title: string;
    description: string;
    tags?: string[];
    accessLevel?: AccessLevel;
    visibility?: Visibility;
}

/** Payload for updating short video metadata (all fields optional). */
export interface UpdateShortPayload {
    title?: string;
    description?: string;
    tags?: string[];
    accessLevel?: AccessLevel;
    visibility?: Visibility;
    thumbnailUrl?: string;
}

/**
 * Payload for the change-status endpoint.
 * - trainer / trainee can only set: draft | pending
 * - admin can set any status: draft | pending | published | rejected
 */
export interface ChangeStatusPayload {
    status: ShortVideoStatus;
    /** Required when status === 'rejected' (admin only). */
    rejectReason?: string;
}

/** Filters for the paginated management list endpoint. */
export interface ListShortsParams {
    page?: number;
    limit?: number;
    status?: ShortVideoStatus | string;
    tags?: string[];
    search?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
}

/**
 * Payload for adding resources to a short video.
 *
 * File upload (multipart/form-data):
 *   - `file`: the raw File object
 *   - `name`: display label for the resource
 *   API fields: `files` (file) + `names` (JSON-stringified array)
 *
 * URL entry (application/json):
 *   - `url`: external URL
 *   - `name`: display label
 *   API body: `{ resources: [{ name, url }] }`
 */
export type AddResourcePayload =
    | { type: 'file'; name: string; file: File }
    | { type: 'url'; name: string; url: string };

/** Payload for tracking watch progress. */
export interface TrackProgressPayload {
    watchedSeconds: number;
}

// ─── Response shapes ──────────────────────────────────────────────────────────

/** Response from POST /v1/short-videos (shell creation). */
export interface ShortVideoShell {
    _id: string;
    title: string;
    status: 'draft';
    videoReady: false;
}

/** Response from POST /v1/short-videos/:id/signed-upload-url */
export interface SignedUploadUrlResponse {
    uploadUrl: string;
    fields: {
        api_key: string;
        timestamp: number;
        signature: string;
        public_id: string;
        notification_url: string;
    };
}

/** Response from GET /v1/short-videos/:id/status (polling). */
export interface UploadStatusResponse {
    status: ShortVideoStatus;
    videoReady: boolean;
    durationSeconds?: number;
    subtitleStatus?: SubtitleStatus;
}

/** Watch progress for a short video. */
export interface WatchProgress {
    watchedSeconds: number;
    completed: boolean;
}

// ─── V1 two-phase upload flow ─────────────────────────────────────────────────

/**
 * Phase 1 — Create a draft shell (metadata only, no video file).
 * POST /v1/short-videos
 *
 * Available to: admin, trainer, trainee
 */
export async function createShortShell(
    data: CreateShortShellPayload
): Promise<ShortVideoShell> {
    const response = await apiClient.post<ApiResponse<ShortVideoShell>>(
        '/v1/short-videos',
        data
    );
    return response.data.data;
}

/**
 * Phase 2 — Generate signed Cloudinary upload parameters.
 * POST /v1/short-videos/:id/signed-upload-url
 *
 * Blocked if status is 'published'.
 */
export async function getSignedUploadUrl(
    shortId: string
): Promise<SignedUploadUrlResponse> {
    const response = await apiClient.post<ApiResponse<SignedUploadUrlResponse>>(
        `/v1/short-videos/${shortId}/signed-upload-url`
    );
    return response.data.data;
}

/**
 * Poll — Check if the Cloudinary webhook has finished processing.
 * GET /v1/short-videos/:id/status
 *
 * Call repeatedly until videoReady === true.
 */
export async function getShortUploadStatus(
    shortId: string
): Promise<UploadStatusResponse> {
    const response = await apiClient.get<ApiResponse<UploadStatusResponse>>(
        `/v1/short-videos/${shortId}/status`
    );
    return response.data.data;
}

/**
 * Phase 3 — Publish a short video directly (admin only, or owner after video is ready).
 * POST /v1/short-videos/:id/publish
 *
 * Requires: cloudinaryId set, title, description, and at least one tag.
 * For the review/approval workflow use changeShortStatus() instead.
 *
 * Admin can publish directly. Trainer/Trainee must use changeShortStatus to set pending.
 */
export async function publishShort(shortId: string): Promise<{ _id: string; status: ShortVideoStatus }> {
    const response = await apiClient.post<ApiResponse<{ _id: string; status: ShortVideoStatus }>>(
        `/v1/short-videos/${shortId}/publish`
    );
    return response.data.data;
}

// ─── V0 management endpoints ──────────────────────────────────────────────────

/**
 * List short videos (management dashboard — all statuses).
 * GET /short-videos
 *
 * Permissions: shortVideoStatus:view (admin, trainer, trainee)
 * - Admin sees all non-draft videos + their own drafts.
 * - Trainer/trainee see their own videos only.
 */
export async function listShorts(params: ListShortsParams = {}): Promise<{
    data: ShortVideoListItem[];
    meta: PaginationMeta;
}> {
    const queryParams: Record<string, string | number> = {
        page: params.page ?? 1,
        limit: params.limit ?? 10,
    };
    if (params.status) queryParams.status = params.status;
    if (params.search) queryParams.q = params.search;
    if (params.sortBy) queryParams.sortBy = params.sortBy;
    if (params.order) queryParams.order = params.order;
    if (params.tags?.length) queryParams.tags = params.tags.join(',');

    const response = await apiClient.get<PaginatedApiResponse<ShortVideoListItem>>(
        '/short-videos',
        { params: queryParams }
    );
    return {
        data: response.data.data,
        meta: response.data.meta,
    };
}

/**
 * List published short videos (end-user feed).
 * GET /short-videos/published-videos
 *
 * Respects visibility and accessLevel gates. Includes per-video watch progress.
 */
export async function listPublishedShorts(params: ListShortsParams = {}): Promise<{
    data: ShortVideoListItem[];
    meta: PaginationMeta;
}> {
    const queryParams: Record<string, string | number> = {
        page: params.page ?? 1,
        limit: params.limit ?? 10,
    };
    if (params.search) queryParams.q = params.search;
    if (params.sortBy) queryParams.sortBy = params.sortBy;
    if (params.order) queryParams.order = params.order;
    if (params.tags?.length) queryParams.tags = params.tags.join(',');

    const response = await apiClient.get<PaginatedApiResponse<ShortVideoListItem>>(
        '/short-videos/published-videos',
        { params: queryParams }
    );
    return {
        data: response.data.data,
        meta: response.data.meta,
    };
}

/**
 * Get a single short video by ID.
 * GET /short-videos/:id
 *
 * Published videos: accessible to all authenticated users (subject to gates).
 * Draft/pending/rejected: owner + admin only.
 */
export async function getShort(shortId: string): Promise<ShortVideo> {
    const response = await apiClient.get<ApiResponse<ShortVideo>>(
        `/short-videos/${shortId}`
    );
    return response.data.data;
}

/**
 * Update short video metadata.
 * PUT /short-videos/:id
 *
 * Permissions: shortVideo:update (owner or admin).
 * Trainer/trainee cannot set status to 'published' or 'rejected' here;
 * use changeShortStatus() for status transitions.
 */
export async function updateShort(
    shortId: string,
    data: UpdateShortPayload
): Promise<ShortVideo> {
    const response = await apiClient.put<ApiResponse<ShortVideo>>(
        `/short-videos/${shortId}`,
        data
    );
    return response.data.data;
}

/**
 * Permanently delete a short video (record + Cloudinary assets).
 * DELETE /short-videos/:id
 *
 * Permissions: shortVideo:delete (owner or admin).
 */
export async function deleteShort(shortId: string): Promise<void> {
    await apiClient.delete(`/short-videos/${shortId}`);
}

/**
 * Remove the Cloudinary video asset only (keeps metadata record).
 * DELETE /short-videos/:id/video
 *
 * Useful to allow re-uploading the video file.
 */
export async function deleteShortVideo(shortId: string): Promise<void> {
    await apiClient.delete(`/short-videos/${shortId}/video`);
}

/**
 * Change the lifecycle status of a short video.
 * PUT /admin/change-status-short-video/:id
 *
 * Status rules:
 * - trainer (Training Admin): draft ↔ pending only
 * - trainee (Clinical Learner): draft ↔ pending only
 * - admin (Super Admin): any status; can publish or reject
 *
 * Admin notifies the video owner via push notification on publish/reject.
 */
export async function changeShortStatus(
    shortId: string,
    payload: ChangeStatusPayload
): Promise<{ _id: string; status: ShortVideoStatus }> {
    const response = await apiClient.put<ApiResponse<{ _id: string; status: ShortVideoStatus }>>(
        `/admin/change-status-short-video/${shortId}`,
        payload
    );
    return response.data.data;
}

/**
 * Trigger subtitle regeneration for a failed captioning job.
 * POST /short-videos/:id/retry-subtitles
 *
 * Only works when subtitleStatus === 'failed'.
 */
export async function retrySubtitles(shortId: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ success: boolean; message: string; data: unknown }>(
        `/short-videos/${shortId}/retry-subtitles`
    );
    return { message: response.data.message };
}

// ─── Resources ────────────────────────────────────────────────────────────────

/**
 * Add file or URL resources to a short video (max 10 total).
 * POST /short-videos/:id/resources
 *
 * File upload → multipart/form-data:
 *   files=@<blob>  (field name: 'files')
 *   names=["Display Name"]  (JSON-stringified array)
 *
 * URL entry → application/json:
 *   { resources: [{ name: "Display Name", url: "https://..." }] }
 */
export async function addShortResource(
    shortId: string,
    payload: AddResourcePayload
): Promise<ShortVideo> {
    let response;

    if (payload.type === 'file') {
        const form = new FormData();
        form.append('files', payload.file);
        form.append('names', JSON.stringify([payload.name]));
        response = await apiClient.post<ApiResponse<ShortVideo>>(
            `/short-videos/${shortId}/resources`,
            form,
            // Unset the default application/json so the browser sets multipart/form-data with boundary
            { headers: { 'Content-Type': undefined } }
        );
    } else {
        response = await apiClient.post<ApiResponse<ShortVideo>>(
            `/short-videos/${shortId}/resources`,
            { resources: [{ name: payload.name, url: payload.url }] }
        );
    }

    return response.data.data;
}

/**
 * Remove a resource from a short video.
 * DELETE /short-videos/:id/resources/:resourceId
 */
export async function removeShortResource(
    shortId: string,
    resourceId: string
): Promise<ShortVideo> {
    const response = await apiClient.delete<ApiResponse<ShortVideo>>(
        `/short-videos/${shortId}/resources/${resourceId}`
    );
    return response.data.data;
}

// ─── Watch progress ───────────────────────────────────────────────────────────

/**
 * Record (or update) the user's watch position for a short video.
 * POST /short-videos/:id/progress
 *
 * Idempotent — stores the maximum watchedSeconds seen.
 * For 'user'-role accounts, tracks by activeProfileId.
 */
export async function trackWatchProgress(
    shortId: string,
    payload: TrackProgressPayload
): Promise<WatchProgress> {
    const response = await apiClient.post<ApiResponse<WatchProgress>>(
        `/short-videos/${shortId}/progress`,
        payload
    );
    return response.data.data;
}

/**
 * Get the current watch position for a short video.
 * GET /short-videos/:id/progress
 */
export async function getWatchProgress(shortId: string): Promise<WatchProgress> {
    const response = await apiClient.get<ApiResponse<WatchProgress>>(
        `/short-videos/${shortId}/progress`
    );
    return response.data.data;
}
