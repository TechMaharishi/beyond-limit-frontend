import { useQuery } from '@tanstack/react-query';
import {
    getCompletionRate,
    getAssignmentSuccess,
    getContentPopularity,
    getTicketStats,
    getAccountTiers
} from '@/services/kpi.service';

export const kpiKeys = {
    all: ['kpi'] as const,
    completionRate: (params?: any) => [...kpiKeys.all, 'completionRate', params] as const,
    assignmentSuccess: (params?: any) => [...kpiKeys.all, 'assignmentSuccess', params] as const,
    contentPopularity: (params?: any) => [...kpiKeys.all, 'contentPopularity', params] as const,
    ticketStats: (params?: any) => [...kpiKeys.all, 'ticketStats', params] as const,
    accountTiers: (params?: any) => [...kpiKeys.all, 'accountTiers', params] as const,
};

export function useCompletionRate(params?: { from?: string; to?: string }) {
    return useQuery({
        queryKey: kpiKeys.completionRate(params),
        queryFn: () => getCompletionRate(params),
    });
}

export function useAssignmentSuccess(params?: { from?: string; to?: string }) {
    return useQuery({
        queryKey: kpiKeys.assignmentSuccess(params),
        queryFn: () => getAssignmentSuccess(params),
    });
}

export function useContentPopularity(params?: { from?: string; to?: string }) {
    return useQuery({
        queryKey: kpiKeys.contentPopularity(params),
        queryFn: () => getContentPopularity(params),
    });
}

export function useTicketStats(params?: { from?: string; to?: string }) {
    return useQuery({
        queryKey: kpiKeys.ticketStats(params),
        queryFn: () => getTicketStats(params),
    });
}

export function useAccountTiers(params?: { from?: string; to?: string }) {
    return useQuery({
        queryKey: kpiKeys.accountTiers(params),
        queryFn: () => getAccountTiers(params),
    });
}
