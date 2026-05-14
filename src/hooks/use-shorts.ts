import {
    useQuery,
    useMutation,
    useQueryClient,
    keepPreviousData,
} from '@tanstack/react-query';
import {
    // V1 two-phase upload
    createShortShell,
    getSignedUploadUrl,
    getShortUploadStatus,
    publishShort,
    // V0 management
    listShorts,
    listPublishedShorts,
    getShort,
    updateShort,
    deleteShort,
    deleteShortVideo,
    changeShortStatus,
    retrySubtitles,
    // Resources
    addShortResource,
    removeShortResource,
    // Thumbnail
    uploadShortThumbnail,
    // Watch progress
    trackWatchProgress,
    getWatchProgress,
    type ShortVideo,
    type ShortVideoListItem,
    type CreateShortShellPayload,
    type UpdateShortPayload,
    type ChangeStatusPayload,
    type ListShortsParams,
    type AddResourcePayload,
    type TrackProgressPayload,
} from '@/services/shorts.service';

// ─── Query-key factory ────────────────────────────────────────────────────────
/**
 * Centralised cache-key factory for all shorts-related queries.
 * Consistent keys ensure correct invalidation across the app.
 */
export const shortsKeys = {
    all: ['shorts'] as const,
    // Management list (admin / trainer / trainee dashboard)
    lists: () => [...shortsKeys.all, 'list'] as const,
    list: (params: ListShortsParams) => [...shortsKeys.lists(), params] as const,
    // Published feed (end-user)
    published: () => [...shortsKeys.all, 'published'] as const,
    publishedList: (params: ListShortsParams) => [...shortsKeys.published(), params] as const,
    // Single item
    details: () => [...shortsKeys.all, 'detail'] as const,
    detail: (id: string) => [...shortsKeys.details(), id] as const,
    // Upload-status polling
    uploadStatus: (id: string) => [...shortsKeys.all, 'upload-status', id] as const,
    // Watch progress
    progress: (id: string) => [...shortsKeys.all, 'progress', id] as const,
};

// ─── V1 Two-phase upload hooks ────────────────────────────────────────────────

/**
 * Phase 1 — Create a draft shell record with metadata only (no video file yet).
 *
 * Role permissions:
 *  - Super Admin  (admin)   → can create
 *  - Training Admin (trainer) → can create
 *  - Clinical Learner (trainee) → can create
 *  - Individual Learner (user)  → ❌ cannot create
 *
 * On success, invalidates the management list so the new draft appears immediately.
 */
export function useCreateShortShell() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateShortShellPayload) => createShortShell(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: shortsKeys.lists() });
        },
    });
}

/**
 * Phase 2 — Request signed Cloudinary upload parameters for a shell.
 *
 * Returns the uploadUrl and signed fields needed for a direct
 * browser-to-Cloudinary upload. Blocked if status is 'published'.
 */
export function useGetSignedUploadUrl() {
    return useMutation({
        mutationFn: (shortId: string) => getSignedUploadUrl(shortId),
    });
}

/**
 * Polling — Check if the Cloudinary webhook has finished processing.
 *
 * Call this after the browser-to-Cloudinary upload completes.
 * Keep polling (e.g. every 3 seconds) until `videoReady === true`.
 *
 * @param shortId – the shell ID from Phase 1
 * @param enabled – set false to pause polling
 */
export function usePollUploadStatus(shortId: string | undefined, enabled: boolean) {
    return useQuery({
        queryKey: shortsKeys.uploadStatus(shortId!),
        queryFn: () => getShortUploadStatus(shortId!),
        enabled: !!shortId && enabled,
        // Refetch every 3 seconds while enabled
        refetchInterval: enabled ? 3000 : false,
        // Don't mark as stale so it keeps polling at the specified interval
        staleTime: 0,
    });
}

/**
 * Phase 3 — Publish a short video directly without the review workflow.
 *
 * Role permissions:
 *  - Super Admin (admin)  → ✅ can publish directly
 *  - Training Admin / Clinical Learner → use changeShortStatus to set 'pending' for review
 *
 * Requires: video uploaded (cloudinaryId set), title, description, ≥1 tag.
 * Invalidates both the detail and list caches on success.
 */
export function usePublishShort() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (shortId: string) => publishShort(shortId),
        onSuccess: (_, shortId) => {
            queryClient.invalidateQueries({ queryKey: shortsKeys.detail(shortId) });
            queryClient.invalidateQueries({ queryKey: shortsKeys.lists() });
            queryClient.invalidateQueries({ queryKey: shortsKeys.published() });
        },
    });
}

// ─── V0 Management list hooks ─────────────────────────────────────────────────

/**
 * Paginated management list for admin / trainer / trainee dashboards.
 * GET /short-videos
 *
 * - Admin sees all non-draft videos + own drafts
 * - Trainer/trainee see their own videos only
 * Supports ?status=, ?tags=, ?q= (search), ?sortBy=, ?order= filters.
 */
export function useShorts(params: ListShortsParams = {}) {
    return useQuery<{ data: ShortVideoListItem[]; meta: { page: number; limit: number; total: number; hasNext: boolean; totalPages?: number } }, Error>({
        queryKey: shortsKeys.list(params),
        queryFn: () => listShorts(params),
        placeholderData: keepPreviousData,
    });
}

/**
 * Paginated end-user published feed.
 * GET /short-videos/published-videos
 *
 * Respects visibility (clinicians / all) and accessLevel gates.
 * Includes per-video watch progress.
 */
export function usePublishedShorts(params: ListShortsParams = {}) {
    return useQuery<{ data: ShortVideoListItem[]; meta: { page: number; limit: number; total: number; hasNext: boolean } }, Error>({
        queryKey: shortsKeys.publishedList(params),
        queryFn: () => listPublishedShorts(params),
        placeholderData: keepPreviousData,
    });
}

/**
 * Fetch full details for a single short video.
 * GET /short-videos/:id
 *
 * Published: all authenticated users (subject to visibility/tier gates).
 * Draft / pending / rejected: owner + admin only.
 */
export function useShort(shortId: string | undefined) {
    return useQuery<ShortVideo, Error>({
        queryKey: shortsKeys.detail(shortId!),
        queryFn: () => getShort(shortId!),
        enabled: !!shortId,
    });
}

// ─── Metadata update hook ─────────────────────────────────────────────────────

/**
 * Update short video metadata (title, description, tags, accessLevel, visibility, thumbnailUrl).
 * PUT /short-videos/:id
 *
 * Trainer/trainee cannot set status via this endpoint — use useChangeShortStatus instead.
 * Invalidates the detail and list caches on success.
 */
export function useUpdateShort() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ shortId, data }: { shortId: string; data: UpdateShortPayload }) =>
            updateShort(shortId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: shortsKeys.detail(variables.shortId) });
            queryClient.invalidateQueries({ queryKey: shortsKeys.lists() });
        },
    });
}

// ─── Delete hooks ─────────────────────────────────────────────────────────────

/**
 * Permanently delete a short video (record + Cloudinary assets).
 * DELETE /short-videos/:id
 *
 * Owner or admin only. Invalidates the list on success.
 */
export function useDeleteShort() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (shortId: string) => deleteShort(shortId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: shortsKeys.lists() });
            queryClient.invalidateQueries({ queryKey: shortsKeys.published() });
        },
    });
}

/**
 * Remove the Cloudinary video asset only (preserves metadata record).
 * DELETE /short-videos/:id/video
 *
 * Useful when the user wants to re-upload a different video file.
 * Invalidates the detail and list caches so `videoReady` updates immediately.
 */
export function useDeleteShortVideo() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (shortId: string) => deleteShortVideo(shortId),
        onSuccess: (_, shortId) => {
            queryClient.invalidateQueries({ queryKey: shortsKeys.detail(shortId) });
            queryClient.invalidateQueries({ queryKey: shortsKeys.lists() });
        },
    });
}

// ─── Status change hook ───────────────────────────────────────────────────────

/**
 * Change the lifecycle status of a short video.
 * PUT /admin/change-status-short-video/:id
 *
 * Status rules enforced by the backend:
 *  - Training Admin (trainer)   → draft ↔ pending only (cannot publish/reject)
 *  - Clinical Learner (trainee) → draft ↔ pending only (cannot publish/reject)
 *  - Super Admin (admin)        → any status (draft / pending / published / rejected)
 *
 * Admin receives a push notification when publishing or rejecting.
 * Invalidates detail + all list views on success.
 */
export function useChangeShortStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ shortId, payload }: { shortId: string; payload: ChangeStatusPayload }) =>
            changeShortStatus(shortId, payload),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: shortsKeys.detail(variables.shortId) });
            queryClient.invalidateQueries({ queryKey: shortsKeys.lists() });
            queryClient.invalidateQueries({ queryKey: shortsKeys.published() });
        },
    });
}

// ─── Subtitle retry hook ──────────────────────────────────────────────────────

/**
 * Manually re-trigger the captioning pipeline for a failed subtitle job.
 * POST /short-videos/:id/retry-subtitles
 *
 * Only works when subtitleStatus === 'failed'.
 * Refetches the detail so the status badge updates immediately to 'pending'.
 */
export function useRetrySubtitles() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (shortId: string) => retrySubtitles(shortId),
        onSuccess: (_, shortId) => {
            queryClient.invalidateQueries({ queryKey: shortsKeys.detail(shortId) });
        },
    });
}

// ─── Resource hooks ───────────────────────────────────────────────────────────

/**
 * Add a file or URL resource to a short video (max 10 resources).
 * POST /short-videos/:id/resources
 *
 * Invalidates the detail cache so the resource list updates immediately.
 */
export function useAddShortResource() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ shortId, payload }: { shortId: string; payload: AddResourcePayload }) =>
            addShortResource(shortId, payload),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: shortsKeys.detail(variables.shortId) });
        },
    });
}

/**
 * Remove a resource from a short video.
 * DELETE /short-videos/:id/resources/:resourceId
 *
 * Invalidates the detail cache on success.
 */
export function useRemoveShortResource() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ shortId, resourceId }: { shortId: string; resourceId: string }) =>
            removeShortResource(shortId, resourceId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: shortsKeys.detail(variables.shortId) });
        },
    });
}

// ─── Watch progress hooks ─────────────────────────────────────────────────────

/**
 * Get the current watch position for a short video.
 * GET /short-videos/:id/progress
 */
export function useWatchProgress(shortId: string | undefined) {
    return useQuery({
        queryKey: shortsKeys.progress(shortId!),
        queryFn: () => getWatchProgress(shortId!),
        enabled: !!shortId,
    });
}

/**
 * Record (or update) the user's watch position.
 * POST /short-videos/:id/progress
 *
 * Idempotent — the server stores the maximum watchedSeconds seen.
 * For 'user'-role accounts, tracks by activeProfileId.
 * Updates the progress cache optimistically on success.
 */
export function useTrackWatchProgress() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ shortId, payload }: { shortId: string; payload: TrackProgressPayload }) =>
            trackWatchProgress(shortId, payload),
        onSuccess: (data, variables) => {
            queryClient.setQueryData(shortsKeys.progress(variables.shortId), data);
        },
    });
}

/**
 * Upload a custom thumbnail for a short video.
 * POST /short-videos/:id/thumbnail  (multipart/form-data)
 * Max 5 MB. Invalidates the short detail cache on success.
 */
export function useUploadShortThumbnail() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ shortId, file }: { shortId: string; file: File }) =>
            uploadShortThumbnail(shortId, file),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: shortsKeys.detail(variables.shortId) });
        },
    });
}
