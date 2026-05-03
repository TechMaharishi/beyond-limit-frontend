import { apiClient } from "@/lib/api";

/**
 * Course Assignment Service
 * Handles API calls for assigning/unassigning courses to users
 */

// Types
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

/**
 * Fetches assignable users by role with pagination and search
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

    if (search) {
        queryParams.search = search;
    }

    const response = await apiClient.get("/admin/list-user/all", { params: queryParams });
    return response.data.data as { users: AssignableUser[]; meta: PaginationMeta };
}

/**
 * Fetches published courses with pagination
 */
export async function fetchPublishedCourses(params: FetchCoursesParams = {}) {
    const { page = 1, limit = 10, sortBy = "createdAt", order = "desc" } = params;

    const response = await apiClient.get("/courses", {
        params: {
            page,
            limit,
            status: "published",
            sortBy,
            order,
        },
    });

    const courses = response.data.data as PublishedCourse[];
    const meta = response.data.meta as PaginationMeta;
    const enrichedMeta: PaginationMeta = {
        ...meta,
        hasPrev: meta.page > 1,
        totalPages: Math.max(1, Math.ceil(meta.total / meta.limit)),
    };
    return { courses, meta: enrichedMeta };
}

/**
 * Fetches courses assigned to a specific user
 */
export async function fetchUserAssignedCourses(
    userId: string,
    params: { page?: number; limit?: number } = {}
) {
    const { page = 1, limit = 10 } = params;

    const response = await apiClient.get(`/assign-course/assignees/${userId}`, {
        params: { page, limit },
    });

    return {
        courses: response.data.data as AssignedCourse[],
        meta: response.data.meta as PaginationMeta,
    };
}

/**
 * Assigns a course to a user
 */
export async function assignCourse(userId: string, courseId: string) {
    const response = await apiClient.post("/assign-course", { userId, courseId });
    return response.data;
}

/**
 * Assigns multiple courses in one request
 */
export async function assignCoursesBulk(
    items: Array<{ userId: string; courseId: string }>
) {
    const response = await apiClient.post("/assign-course/bulk", { items });
    return response.data;
}

/**
 * Unassigns a course from a user
 */
export async function unassignCourse(userId: string, courseId: string) {
    const response = await apiClient.delete("/assign-course", {
        data: { userId, courseId },
    });
    return response.data;
}
