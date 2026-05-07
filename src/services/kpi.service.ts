import { apiClient } from '@/lib/api';

export interface KPIPeriod {
    from: string;
    to: string;
}

export interface KPICompletionRate {
    period: KPIPeriod;
    courses: { totalAssigned: number; completed: number; completionRate: number };
    shorts: { totalAssigned: number; completed: number; completionRate: number };
    usersByAccountType: { accountType: string; count: number }[];
}

export interface KPIAssignmentSuccess {
    period: KPIPeriod;
    courses: { totalAssigned: number; started: number; successRate: number };
    shorts: { totalAssigned: number; started: number; successRate: number };
}

export interface KPIContentPopularity {
    period: KPIPeriod;
    courses: { topByAssignments: any[]; topByWatchers: any[] };
    shorts: { topByAssignments: any[]; topByWatchers: any[] };
}

export interface KPITicketStats {
    period: KPIPeriod;
    byStatus: { status: string; count: number }[];
    byType: { type: string; count: number }[];
    resolution: { resolvedCount: number; avgHours: number; minHours: number; maxHours: number };
}

export interface KPIAccountTiers {
    period: KPIPeriod;
    currentSnapshot: { accountType: string; count: number; percentage: number }[];
    newInPeriod: { accountType: string; newUsers: number }[];
    monthlyTrend: { year: number; month: number; accountType: string; count: number }[];
}

interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
}

export async function getCompletionRate(params?: { from?: string; to?: string }): Promise<KPICompletionRate> {
    const { data } = await apiClient.get<ApiResponse<KPICompletionRate>>('/kpi/completion-rate', { params });
    return data.data;
}

export async function getAssignmentSuccess(params?: { from?: string; to?: string }): Promise<KPIAssignmentSuccess> {
    const { data } = await apiClient.get<ApiResponse<KPIAssignmentSuccess>>('/kpi/assignment-success', { params });
    return data.data;
}

export async function getContentPopularity(params?: { from?: string; to?: string }): Promise<KPIContentPopularity> {
    const { data } = await apiClient.get<ApiResponse<KPIContentPopularity>>('/kpi/content-popularity', { params });
    return data.data;
}

export async function getTicketStats(params?: { from?: string; to?: string }): Promise<KPITicketStats> {
    const { data } = await apiClient.get<ApiResponse<KPITicketStats>>('/kpi/ticket-stats', { params });
    return data.data;
}

export async function getAccountTiers(params?: { from?: string; to?: string }): Promise<KPIAccountTiers> {
    const { data } = await apiClient.get<ApiResponse<KPIAccountTiers>>('/kpi/account-tiers', { params });
    return data.data;
}
