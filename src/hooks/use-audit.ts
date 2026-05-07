import { useQuery } from '@tanstack/react-query';
import { getAuditLogs, getAuditSummary, type AuditLogParams } from '@/services/audit.service';

export const auditKeys = {
    all: ['audit'] as const,
    logs: (params?: AuditLogParams) => [...auditKeys.all, 'logs', params] as const,
    summary: () => [...auditKeys.all, 'summary'] as const,
    byCategory: (category: string, params?: AuditLogParams) =>
        [...auditKeys.all, 'category', category, params] as const,
};

export function useAuditLogs(params?: AuditLogParams) {
    return useQuery({
        queryKey: auditKeys.logs(params),
        queryFn: () => getAuditLogs(params),
    });
}

export function useAuditSummary() {
    return useQuery({
        queryKey: auditKeys.summary(),
        queryFn: () => getAuditSummary(),
    });
}

export function useAuditByCategory(category: string, params?: Omit<AuditLogParams, 'category'>) {
    return useQuery({
        queryKey: auditKeys.byCategory(category, params),
        queryFn: () => getAuditLogs({ ...params, category }),
    });
}
