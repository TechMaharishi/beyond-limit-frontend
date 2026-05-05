import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    fetchNotifications,
    markNotificationRead,
    deleteNotification,
    clearAllNotifications,
    type FetchNotificationsParams,
    type Notification,
} from "@/services/notifications.service";

export const notificationsKeys = {
    all: ["notifications"] as const,
    list: (params: FetchNotificationsParams) => ["notifications", params] as const,
};

type QueriesSnapshot = [readonly unknown[], Notification[] | undefined][];

function snapshotAll(queryClient: ReturnType<typeof useQueryClient>) {
    return queryClient.getQueriesData<Notification[]>({ queryKey: notificationsKeys.all });
}

function restoreAll(queryClient: ReturnType<typeof useQueryClient>, snapshot: QueriesSnapshot) {
    snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

export function useNotifications(params: FetchNotificationsParams = {}) {
    return useQuery({
        queryKey: notificationsKeys.list(params),
        queryFn: () => fetchNotifications(params),
        staleTime: 30 * 1000,
        refetchInterval: 60 * 1000,
    });
}

export function useMarkNotificationRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: markNotificationRead,
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: notificationsKeys.all });
            const snapshot = snapshotAll(queryClient);
            queryClient.setQueriesData<Notification[]>(
                { queryKey: notificationsKeys.all },
                (old) => old?.map((n) => (n._id === id ? { ...n, read: true } : n))
            );
            return { snapshot };
        },
        onError: (_err, _id, ctx) => restoreAll(queryClient, ctx?.snapshot ?? []),
        onSettled: () => queryClient.invalidateQueries({ queryKey: notificationsKeys.all }),
    });
}

export function useMarkAllNotificationsRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (ids: string[]) => Promise.all(ids.map(markNotificationRead)),
        onMutate: async (ids) => {
            await queryClient.cancelQueries({ queryKey: notificationsKeys.all });
            const snapshot = snapshotAll(queryClient);
            const idSet = new Set(ids);
            queryClient.setQueriesData<Notification[]>(
                { queryKey: notificationsKeys.all },
                (old) => old?.map((n) => (idSet.has(n._id) ? { ...n, read: true } : n))
            );
            return { snapshot };
        },
        onError: (_err, _ids, ctx) => restoreAll(queryClient, ctx?.snapshot ?? []),
        onSettled: () => queryClient.invalidateQueries({ queryKey: notificationsKeys.all }),
    });
}

export function useDeleteNotification() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteNotification,
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: notificationsKeys.all });
            const snapshot = snapshotAll(queryClient);
            queryClient.setQueriesData<Notification[]>(
                { queryKey: notificationsKeys.all },
                (old) => old?.filter((n) => n._id !== id)
            );
            return { snapshot };
        },
        onError: (_err, _id, ctx) => restoreAll(queryClient, ctx?.snapshot ?? []),
        onSettled: () => queryClient.invalidateQueries({ queryKey: notificationsKeys.all }),
    });
}

export function useClearAllNotifications() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: clearAllNotifications,
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: notificationsKeys.all });
            const snapshot = snapshotAll(queryClient);
            queryClient.setQueriesData<Notification[]>(
                { queryKey: notificationsKeys.all },
                () => []
            );
            return { snapshot };
        },
        onError: (_err, _v, ctx) => restoreAll(queryClient, ctx?.snapshot ?? []),
        onSettled: () => queryClient.invalidateQueries({ queryKey: notificationsKeys.all }),
    });
}
