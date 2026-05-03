import { apiClient } from "@/lib/api";
import type {
    AssignableUser,
    FetchUsersParams,
    PaginationMeta,
} from "@/services/assign-course.service";
import { fetchAssignableUsers } from "@/services/assign-course.service";

export type AssignableRole = "trainee" | "user";

export interface PublishedShortVideo {
    _id: string;
    title: string;
    description: string;
    thumbnailUrl: string;
    tags: string[];
    status: string;
    accessLevel: string;
    visibility: string;
    user: string;
    createdBy: {
        _id: string;
        name: string;
        email: string;
    };
    durationSeconds: number;
    createdAt: string;
    updatedAt: string;
}

export interface AssignedShort {
    short: PublishedShortVideo;
    assignedBy: {
        id: string;
        name: string;
        role: string;
    };
    assignedAt: string;
    progress: {
        watchedSeconds: number;
        percentCompleted: number;
        completed: boolean;
    };
}

export interface FetchShortsParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    order?: "asc" | "desc";
}

function enrichMeta(meta: PaginationMeta): PaginationMeta {
    return {
        ...meta,
        hasPrev: meta.page > 1,
        totalPages: Math.max(1, Math.ceil(meta.total / meta.limit)),
    };
}

export async function fetchAssignableUsersForShorts(role: AssignableRole, params: FetchUsersParams = {}) {
    return fetchAssignableUsers(role, params) as Promise<{
        users: AssignableUser[];
        meta: PaginationMeta;
    }>;
}

export async function fetchPublishedShortVideos(params: FetchShortsParams = {}) {
    const { page = 1, limit = 10, sortBy = "createdAt", order = "desc" } = params;

    const response = await apiClient.get("/short-videos", {
        params: {
            page,
            limit,
            status: "published",
            sortBy,
            order,
        },
    });

    const shorts = response.data.data as PublishedShortVideo[];
    const meta = response.data.meta as PaginationMeta;

    return { shorts, meta: enrichMeta(meta) };
}

export async function fetchUserAssignedShorts(
    userId: string,
    params: { page?: number; limit?: number } = {}
) {
    const { page = 1, limit = 10 } = params;

    const response = await apiClient.get(`/assign-shorts/assignees/${userId}`, {
        params: { page, limit },
    });

    const shorts = response.data.data as AssignedShort[];
    const meta = response.data.meta as PaginationMeta;

    return { shorts, meta: enrichMeta(meta) };
}

export async function assignShort(userId: string, shortVideoId: string) {
    const response = await apiClient.post("/assign-shorts", { userId, shortVideoId });
    return response.data;
}

export async function assignShortsBulk(
    items: Array<{ userId: string; shortVideoId: string }>
) {
    const response = await apiClient.post("/assign-shorts/bulk", { items });
    return response.data;
}

export async function unassignShort(userId: string, shortVideoId: string) {
    const response = await apiClient.delete("/assign-shorts", {
        data: { userId, shortVideoId },
    });
    return response.data;
}
