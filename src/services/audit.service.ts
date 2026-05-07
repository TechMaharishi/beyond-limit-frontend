import { apiClient } from '@/lib/api';

export interface AuditLog {
    _id: string;
    actorId: string;
    actorRole: string;
    actorEmail: string;
    category: "auth" | "admin" | "content" | "support";
    action: string;
    targetId?: string;
    targetType?: string;
    meta?: any;
    ip?: string;
    createdAt: string;
}

export interface AuditSummary {
    period: string;
    categoryBreakdown: { category: string; label: string; count: number }[];
    topActions: { action: string; count: number }[];
}

interface PaginatedResponse<T> {
    success: boolean;
    message: string;
    data: T[];
    meta: {
        page: number;
        limit: number;
        offset: number;
        total: number;
        hasNext: boolean;
    }
}

interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
}

export interface AuditLogParams {
    category?: string;
    action?: string;
    actorId?: string;
    targetId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
}

export async function getAuditLogs(params?: AuditLogParams): Promise<PaginatedResponse<AuditLog>> {
    const { data } = await apiClient.get<PaginatedResponse<AuditLog>>('/audit/logs', { params });
    return data;
}

export async function getAuditSummary(): Promise<AuditSummary> {
    const { data } = await apiClient.get<ApiResponse<AuditSummary>>('/audit/summary');
    return data.data;
}
