import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { enqueueNotificationToast } from "@/components/notifications/notification-toast-queue";
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
        staleTime: 10 * 1000,
        refetchInterval: 15 * 1000,
        refetchOnWindowFocus: true,
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

// Max unread toasts shown on login to avoid overwhelming the user.
const MAX_INITIAL_TOASTS = 5;
// Delay between each staggered toast (ms).
const STAGGER_MS = 700;

/**
 * Watches the polling feed and drip-feeds notification toasts from the bottom-left.
 * - On first load: staggers unread notifications one at a time (max 5).
 * - During session: immediately shows any new notification that arrives via polling.
 * Mount once at the app shell level.
 */
export function useNotificationToasts() {
    const { data: notifications = [] } = useNotifications({ limit: 50 });
    const seenIds = useRef<Set<string> | null>(null);
    const timers  = useRef<ReturnType<typeof setTimeout>[]>([]);

    useEffect(() => {
        if (notifications.length === 0) return;

        if (seenIds.current === null) {
            // First load — seed seen set and stagger unread toasts.
            seenIds.current = new Set(notifications.map((n) => n._id));

            const unread = notifications.filter((n) => !n.read).slice(0, MAX_INITIAL_TOASTS);
            unread.forEach((n, i) => {
                const t = setTimeout(() => enqueueNotificationToast(n), i * STAGGER_MS);
                timers.current.push(t);
            });
            return;
        }

        // During session — any unseen ID is a real-time arrival, show immediately.
        for (const n of notifications) {
            if (!seenIds.current.has(n._id)) {
                seenIds.current.add(n._id);
                enqueueNotificationToast(n);
            }
        }
    }, [notifications]);

    // Clean up pending timers on unmount.
    useEffect(() => () => timers.current.forEach(clearTimeout), []);
}
