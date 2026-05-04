import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FetchUsersParams } from "@/services/assign-course.service";
import {
    assignShort,
    assignShortsBulk,
    fetchAssignableUsersForShorts,
    fetchPublishedShortVideos,
    fetchUserAssignedShorts,
    fetchUserProfiles,
    unassignShort,
    type FetchShortsParams,
} from "@/services/assign-shorts.service";
import type { AssignableRole } from "@/services/assign-shorts.service";

export function useAssignableUsersForShorts(
    role: AssignableRole,
    params: FetchUsersParams = {},
    enabled = true
) {
    return useQuery({
        queryKey: ["assignable-users-shorts", role, params],
        queryFn: () => fetchAssignableUsersForShorts(role, params),
        enabled,
        staleTime: 2 * 60 * 1000,
    });
}

export function usePublishedShortVideos(params: FetchShortsParams = {}) {
    return useQuery({
        queryKey: ["published-short-videos", params],
        queryFn: () => fetchPublishedShortVideos(params),
        staleTime: 5 * 60 * 1000,
    });
}

export function useUserProfilesForAssignment(userId: string | null) {
    return useQuery({
        queryKey: ["user-profiles-assignment", userId],
        queryFn: () => fetchUserProfiles(userId!),
        enabled: !!userId,
        staleTime: 2 * 60 * 1000,
    });
}

export function useUserAssignedShorts(
    userId: string | null,
    params: { page?: number; limit?: number; profileId?: string } = {}
) {
    return useQuery({
        queryKey: ["user-assigned-shorts", userId, params],
        queryFn: () => fetchUserAssignedShorts(userId!, params),
        enabled: !!userId,
        staleTime: 1 * 60 * 1000,
    });
}

export function useAssignShort() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, shortVideoId, profileId }: { userId: string; shortVideoId: string; profileId?: string }) =>
            assignShort(userId, shortVideoId, profileId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["user-assigned-shorts"] });
        },
    });
}

export function useAssignShortsBulk() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (items: Array<{ userId: string; shortVideoId: string; profileId?: string }>) =>
            assignShortsBulk(items),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["user-assigned-shorts"] });
        },
    });
}

export function useUnassignShort() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, shortVideoId, profileId }: { userId: string; shortVideoId: string; profileId?: string }) =>
            unassignShort(userId, shortVideoId, profileId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["user-assigned-shorts"] });
        },
    });
}
