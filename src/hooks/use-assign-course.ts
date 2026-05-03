import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    fetchAssignableUsers,
    fetchPublishedCourses,
    fetchUserAssignedCourses,
    assignCourse,
    assignCoursesBulk,
    unassignCourse,
    type FetchUsersParams,
    type FetchCoursesParams,
} from "@/services/assign-course.service";

/**
 * TanStack Query hooks for course assignment feature
 */

/**
 * Fetches assignable users by role (trainee or user)
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
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
}

/**
 * Fetches published courses for assignment
 */
export function usePublishedCourses(params: FetchCoursesParams = {}) {
    return useQuery({
        queryKey: ["published-courses", params],
        queryFn: () => fetchPublishedCourses(params),
        staleTime: 5 * 60 * 1000, // 5 minutes - courses don't change often
    });
}

/**
 * Fetches courses assigned to a specific user
 */
export function useUserAssignedCourses(
    userId: string | null,
    params: { page?: number; limit?: number } = {}
) {
    return useQuery({
        queryKey: ["user-assigned-courses", userId, params],
        queryFn: () => fetchUserAssignedCourses(userId!, params),
        enabled: !!userId,
        staleTime: 1 * 60 * 1000, // 1 minute
    });
}

/**
 * Mutation for assigning a course to a user
 */
export function useAssignCourse() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, courseId }: { userId: string; courseId: string }) =>
            assignCourse(userId, courseId),
        onSuccess: () => {
            // Invalidate user lists and assigned courses
            queryClient.invalidateQueries({ queryKey: ["assignable-users"] });
            queryClient.invalidateQueries({ queryKey: ["user-assigned-courses"] });
        },
    });
}

/**
 * Mutation for bulk assigning courses to users
 */
export function useAssignCoursesBulk() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (items: Array<{ userId: string; courseId: string }>) =>
            assignCoursesBulk(items),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["assignable-users"] });
            queryClient.invalidateQueries({ queryKey: ["user-assigned-courses"] });
        },
    });
}

/**
 * Mutation for unassigning a course from a user
 */
export function useUnassignCourse() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, courseId }: { userId: string; courseId: string }) =>
            unassignCourse(userId, courseId),
        onSuccess: () => {
            // Invalidate assigned courses queries
            queryClient.invalidateQueries({ queryKey: ["user-assigned-courses"] });
        },
    });
}
