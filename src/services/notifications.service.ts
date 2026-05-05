import { apiClient } from "@/lib/api";

export interface Notification {
    _id: string;
    userId: string;
    title: string;
    body: string;
    data?: {
        _id?: string;
        event?: string;
        type?: string;
        [key: string]: unknown;
    };
    read: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface FetchNotificationsParams {
    read?: boolean;
    limit?: number;
}

export async function fetchNotifications(
    params: FetchNotificationsParams = {}
): Promise<Notification[]> {
    const response = await apiClient.get("/notifications", { params });
    return response.data.data as Notification[];
}

export async function markNotificationRead(id: string): Promise<void> {
    await apiClient.post(`/notifications/${id}/read`);
}

export async function deleteNotification(id: string): Promise<void> {
    await apiClient.delete(`/notifications/${id}`);
}

export async function clearAllNotifications(): Promise<void> {
    await apiClient.delete("/notifications");
}

export async function registerDeviceToken(
    deviceToken: string,
    deviceType: "ios" | "android" | "web"
): Promise<void> {
    await apiClient.post("/notifications/tokens-register", { deviceToken, deviceType });
}

export async function deregisterDeviceToken(deviceToken: string): Promise<void> {
    await apiClient.post("/notifications/tokens-deregister", { deviceToken });
}
