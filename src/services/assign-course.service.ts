import { apiClient } from "@/lib/api";

/**
 * Course Assignment Service
 * Handles API calls for assigning/unassigning courses to users.
 * Individual Learners (role: "user") now require a profileId.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssignableUser {
    id: string;
    name: string;
    email: string;
    role: string;
    accountType: string;
    banned: boolean;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface UserProfile {
    _id: string;
    userId: string;
    name: string;
    avatar: string;
    isDefault: boolean;
    createdAt: string;
}

export interface PublishedCourse {
    _id: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    tags: string[];
    status: string;
    accessLevel: string;
    createdAt: string;
    updatedAt: string;
}

export interface AssignedCourse {
    course: {
        _id: string;
        title: string;
        description: string;
        thumbnailUrl: string;
        tags: string[];
        status: string;
        accessLevel: string;
        createdAt: string;
        updatedAt: string;
    };
    assignedBy: {
        id: string;
        name: string;
        role: string;
    };
    profileId?: string;
    assignedAt: string;
    progressSummary: {
        percentCompleted: number;
        completed: boolean;
    };
}

export interface PaginationMeta {
    page: number;
    offset: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev?: boolean;
    totalPages?: number;
}

export interface FetchUsersParams {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
}

export interface FetchCoursesParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    order?: "asc" | "desc";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function enrichMeta(meta: PaginationMeta): PaginationMeta {
    return {
        ...meta,
        hasPrev: meta.page > 1,
        totalPages: Math.max(1, Math.ceil(meta.total / meta.limit)),
    };
}

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * Fetches assignable users by role with pagination and search.
 */
export async function fetchAssignableUsers(
    role: "trainee" | "user",
    params: FetchUsersParams = {}
) {
    const {
        page = 1,
        limit = 10,
        search = "",
        sortBy = "createdAt",
        sortDirection = "asc",
    } = params;

    const queryParams: Record<string, string | number> = {
        page,
        limit,
        sortBy,
        sortDirection,
        role,
        field: "name",
    };
    if (search) queryParams.search = search;

    const response = await apiClient.get("/admin/list-user/all", { params: queryParams });
    return response.data.data as { users: AssignableUser[]; meta: PaginationMeta };
}

/**
 * Fetches published courses using the updated /courses/published-videos endpoint.
 */
export async function fetchPublishedCourses(params: FetchCoursesParams = {}) {
    const { page = 1, limit = 10, sortBy = "createdAt", order = "desc" } = params;

    const response = await apiClient.get("/courses/published-videos", {
        params: { page, limit, sortBy, order },
    });

    const courses = response.data.data as PublishedCourse[];
    const meta = response.data.meta as PaginationMeta;
    return { courses, meta: enrichMeta(meta) };
}

/**
 * Fetches profiles for a specific user (for Individual Learners).
 */
export async function fetchUserProfilesForCourse(userId: string): Promise<UserProfile[]> {
    const response = await apiClient.get("/admin/user-profiles", { params: { userId } });
    const data = response.data.data;
    return Array.isArray(data) ? data : [data].filter(Boolean);
}

/**
 * Fetches courses assigned to a specific user, with optional profileId filter.
 */
export async function fetchUserAssignedCourses(
    userId: string,
    params: { page?: number; limit?: number; profileId?: string } = {}
) {
    const { page = 1, limit = 10, profileId } = params;

    const response = await apiClient.get(`/assign-course/assignees/${userId}`, {
        params: { page, limit, ...(profileId ? { profileId } : {}) },
    });

    const courses = response.data.data as AssignedCourse[];
    const meta = response.data.meta as PaginationMeta;
    return { courses, meta: enrichMeta(meta) };
}

/**
 * Assigns a single course to a user (with optional profileId for user-role targets).
 */
export async function assignCourse(userId: string, courseId: string, profileId?: string) {
    const response = await apiClient.post("/assign-course", {
        userId,
        courseId,
        ...(profileId ? { profileId } : {}),
    });
    return response.data;
}

/**
 * Bulk assigns courses to users (profileId required per-item for user-role targets).
 */
export async function assignCoursesBulk(
    items: Array<{ userId: string; courseId: string; profileId?: string }>
) {
    const response = await apiClient.post("/assign-course/bulk", { items });
    return response.data;
}

/**
 * Unassigns a course from a user (with optional profileId).
 */
export async function unassignCourse(userId: string, courseId: string, profileId?: string) {
    const response = await apiClient.delete("/assign-course", {
        data: { userId, courseId, ...(profileId ? { profileId } : {}) },
    });
    return response.data;
}
