import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    fetchAssignableUsers,
    fetchPublishedCourses,
    fetchUserAssignedCourses,
    fetchUserProfilesForCourse,
    assignCourse,
    assignCoursesBulk,
    unassignCourse,
    type FetchUsersParams,
    type FetchCoursesParams,
} from "@/services/assign-course.service";

/**
 * TanStack Query hooks for course assignment feature.
 * Updated to support profileId for Individual Learner (user-role) targets.
 */

export function useAssignableUsers(
    role: "trainee" | "user",
    params: FetchUsersParams = {},
    enabled = true
) {
    return useQuery({
        queryKey: ["assignable-users", role, params],
        queryFn: () => fetchAssignableUsers(role, params),
        enabled,
        staleTime: 2 * 60 * 1000,
    });
}

export function usePublishedCourses(params: FetchCoursesParams = {}) {
    return useQuery({
        queryKey: ["published-courses-assign", params],
        queryFn: () => fetchPublishedCourses(params),
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Fetches profiles for an Individual Learner — required before assigning a course.
 */
export function useUserProfilesForCourseAssignment(userId: string | null) {
    return useQuery({
        queryKey: ["user-profiles-course", userId],
        queryFn: () => fetchUserProfilesForCourse(userId!),
        enabled: !!userId,
        staleTime: 2 * 60 * 1000,
    });
}

/**
 * Fetches courses assigned to a specific user, optionally filtered by profileId.
 */
export function useUserAssignedCourses(
    userId: string | null,
    params: { page?: number; limit?: number; profileId?: string } = {}
) {
    return useQuery({
        queryKey: ["user-assigned-courses", userId, params],
        queryFn: () => fetchUserAssignedCourses(userId!, params),
        enabled: !!userId,
        staleTime: 1 * 60 * 1000,
    });
}

export function useAssignCourse() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, courseId, profileId }: { userId: string; courseId: string; profileId?: string }) =>
            assignCourse(userId, courseId, profileId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["user-assigned-courses"] });
        },
    });
}

export function useAssignCoursesBulk() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (items: Array<{ userId: string; courseId: string; profileId?: string }>) =>
            assignCoursesBulk(items),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["user-assigned-courses"] });
        },
    });
}

export function useUnassignCourse() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, courseId, profileId }: { userId: string; courseId: string; profileId?: string }) =>
            unassignCourse(userId, courseId, profileId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["user-assigned-courses"] });
        },
    });
}
