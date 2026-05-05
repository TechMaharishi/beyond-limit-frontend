import { getToken, onMessage } from "firebase/messaging";
import { messaging } from "@/lib/firebase";
import { registerDeviceToken, deregisterDeviceToken } from "@/services/notifications.service";

const VAPID_KEY = "BA2IHr_-8IJF7geogwzFDnNm_t9liCxO8X3H-JihowLzpDiYR26T0dIhJJiK2OR6Rh5fybqObTOxCuqt5WJjkWY";
const STORED_TOKEN_KEY = "fcm_web_token";

export async function initWebPush(onNewNotification?: () => void): Promise<void> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) return;

    const storedToken = localStorage.getItem(STORED_TOKEN_KEY);
    if (token !== storedToken) {
      // Deregister old token if it changed
      if (storedToken) {
        await deregisterDeviceToken(storedToken).catch(() => {});
      }
      await registerDeviceToken(token, "web");
      localStorage.setItem(STORED_TOKEN_KEY, token);
    }

    // Handle foreground messages (tab is open and focused)
    onMessage(messaging, () => {
      onNewNotification?.();
    });
  } catch {
    // Permission denied or browser not supported — fail silently
  }
}

export async function cleanupWebPush(): Promise<void> {
  const token = localStorage.getItem(STORED_TOKEN_KEY);
  if (!token) return;
  try {
    await deregisterDeviceToken(token);
    localStorage.removeItem(STORED_TOKEN_KEY);
  } catch {
    // ignore
  }
}
