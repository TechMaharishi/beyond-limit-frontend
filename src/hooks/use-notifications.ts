import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    fetchNotifications,
    markNotificationRead,
    deleteNotification,
    clearAllNotifications,
    type FetchNotificationsParams,
} from "@/services/notifications.service";

export const notificationsKeys = {
    all: ["notifications"] as const,
    list: (params: FetchNotificationsParams) => ["notifications", params] as const,
};

export function useNotifications(params: FetchNotificationsParams = {}) {
    return useQuery({
        queryKey: notificationsKeys.list(params),
        queryFn: () => fetchNotifications(params),
        staleTime: 30 * 1000,
        refetchInterval: 60 * 1000,
    });
}

export function useUnreadCount() {
    const { data = [] } = useNotifications({ read: false, limit: 100 });
    return data.filter((n) => !n.read).length;
}

export function useMarkNotificationRead() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: markNotificationRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
        },
    });
}

export function useDeleteNotification() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteNotification,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
        },
    });
}

export function useClearAllNotifications() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: clearAllNotifications,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
        },
    });
}
