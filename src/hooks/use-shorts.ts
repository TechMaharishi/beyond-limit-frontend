import {
    useQuery,
    useMutation,
    useQueryClient
} from '@tanstack/react-query';
import {
    getShort,
    createShort,
    updateShort,
    deleteShort,
    deleteShortVideo,
    changeShortStatus,
    retrySubtitles,
    type ShortVideo,
    type CreateShortPayload,
    type UpdateShortPayload,
    type ShortVideoStatus
} from '@/services/shorts.service';

/**
 * React Query key factory for shorts management.
 * Centralizes cache key logic to ensure consistency across queries and invalidations.
 */
export const shortsKeys = {
    all: ['shorts'] as const,
    lists: () => [...shortsKeys.all, 'list'] as const,
    detail: (id: string) => [...shortsKeys.all, 'detail', id] as const,
};

/**
 * Retrieves detailed information for a specific short video.
 * Enabled only when a valid shortId is provided to prevent unnecessary requests.
 */
export function useShort(shortId: string | undefined) {
    return useQuery<ShortVideo, Error>({
        queryKey: shortsKeys.detail(shortId!),
        queryFn: () => getShort(shortId!),
        enabled: !!shortId,
    });
}

/**
 * Creates a new short video entity.
 * Invalidates the shorts list query on success to reflect the new entry immediately.
 */
export function useCreateShort() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateShortPayload) => createShort(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: shortsKeys.lists() });
        },
    });
}

/**
 * Updates an existing short video's metadata.
 * Invalidates both specific short details and the general list to ensure data consistency.
 */
export function useUpdateShort() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            shortId,
            data,
        }: {
            shortId: string;
            data: UpdateShortPayload;
        }) => updateShort(shortId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: shortsKeys.detail(variables.shortId) });
            queryClient.invalidateQueries({ queryKey: shortsKeys.lists() });
        },
    });
}

/**
 * Permanently deletes a short video.
 * Triggers a refresh of the shorts list upon successful deletion.
 */
export function useDeleteShort() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (shortId: string) => deleteShort(shortId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: shortsKeys.lists() });
        },
    });
}

/**
 * Deletes the video attached to a short video.
 * Refreshes the specific short details and the shorts list.
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

/**
 * Updates the publication status of a short video (e.g., Draft, Published).
 * Invalidates both detail and list views to ensure status visibility is consistent across the app.
 */
export function useChangeShortStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ shortId, status }: { shortId: string; status: ShortVideoStatus }) =>
            changeShortStatus(shortId, status),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: shortsKeys.detail(variables.shortId) });
            queryClient.invalidateQueries({ queryKey: shortsKeys.lists() });
        },
    });
}

/**
 * Triggers subtitle regeneration for a short video.
 * On success, re-fetches the short detail so the status badge updates immediately.
 */
export function useRetrySubtitles() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (shortId: string) => retrySubtitles(shortId),
        onSuccess: (_, shortId) => {
            // Refetch the detail so subtitle_status flips to "pending" immediately
            queryClient.invalidateQueries({ queryKey: shortsKeys.detail(shortId) });
        },
    });
}
