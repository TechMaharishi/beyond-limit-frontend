/**
 * Bottom-left notification toast system.
 *
 * Usage:
 *   enqueueNotificationToast(notification)  — add to queue from anywhere
 *   <NotificationToastContainer />          — mount once in app shell
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { X, BookOpen, Play, Stethoscope, Ticket, Video, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notification } from "@/services/notifications.service";

// ── Event config ──────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    "support-ticket-created": { icon: Ticket,      color: "text-orange-500", bg: "bg-orange-500/10" },
    "clinical-assigned":      { icon: Stethoscope, color: "text-teal-500",   bg: "bg-teal-500/10"   },
    "course-assigned":        { icon: BookOpen,    color: "text-blue-500",   bg: "bg-blue-500/10"   },
    "course-video-added":     { icon: Video,       color: "text-blue-500",   bg: "bg-blue-500/10"   },
    "short-assigned":         { icon: Play,        color: "text-purple-500", bg: "bg-purple-500/10" },
    "short-video-status":     { icon: Play,        color: "text-purple-500", bg: "bg-purple-500/10" },
};
const DEFAULT_CFG = { icon: Bell, color: "text-muted-foreground", bg: "bg-muted" };

const TOAST_DURATION = 5500; // ms before auto-dismiss

// ── Module-level queue ────────────────────────────────────────────────────────

type ToastItem = Notification & { toastId: string };

type Listener = (items: ToastItem[]) => void;
let _queue: ToastItem[] = [];
const _listeners = new Set<Listener>();

function notify() {
    _listeners.forEach((l) => l([..._queue]));
}

export function enqueueNotificationToast(notification: Notification) {
    const toastId = `${notification._id}-${Date.now()}`;
    _queue = [..._queue, { ...notification, toastId }];
    notify();
}

function dismissToast(toastId: string) {
    _queue = _queue.filter((t) => t.toastId !== toastId);
    notify();
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ duration, onDone }: { duration: number; onDone: () => void }) {
    const [width, setWidth] = useState(100);
    const start = useRef(Date.now());
    const frame = useRef<number>(0);

    useEffect(() => {
        const tick = () => {
            const elapsed = Date.now() - start.current;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            setWidth(remaining);
            if (remaining > 0) {
                frame.current = requestAnimationFrame(tick);
            } else {
                onDone();
            }
        };
        frame.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame.current);
    }, [duration, onDone]);

    return (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-border overflow-hidden rounded-b-xl">
            <div
                className="h-full bg-primary transition-none"
                style={{ width: `${width}%` }}
            />
        </div>
    );
}

// ── Single toast card ─────────────────────────────────────────────────────────

function NotificationToastCard({
    item,
    onDismiss,
}: {
    item: ToastItem;
    onDismiss: () => void;
}) {
    const [visible, setVisible] = useState(false);
    const [exiting, setExiting] = useState(false);
    const cfg = EVENT_CONFIG[item.data?.event ?? ""] ?? DEFAULT_CFG;
    const Icon = cfg.icon;

    // Trigger enter animation on next tick
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 10);
        return () => clearTimeout(t);
    }, []);

    const dismiss = useCallback(() => {
        setExiting(true);
        setTimeout(onDismiss, 250);
    }, [onDismiss]);

    return (
        <div
            className={cn(
                "relative w-[340px] rounded-xl border bg-background shadow-lg overflow-hidden",
                "transition-all duration-300 ease-out",
                visible && !exiting
                    ? "translate-x-0 opacity-100"
                    : exiting
                    ? "translate-x-full opacity-0"
                    : "translate-x-full opacity-0"
            )}
        >
            <div className="flex gap-3 px-4 py-3.5">
                {/* Icon */}
                <div className={cn("mt-0.5 size-8 rounded-full flex items-center justify-center shrink-0", cfg.bg)}>
                    <Icon className={cn("size-4", cfg.color)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <p className="text-sm font-semibold leading-snug line-clamp-1 pr-5">
                        {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.body}
                    </p>
                </div>
            </div>

            {/* Close button */}
            <button
                onClick={dismiss}
                className="absolute top-2.5 right-2.5 size-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
                <X className="size-3" />
            </button>

            {/* Progress bar — auto-dismisses when done */}
            <ProgressBar duration={TOAST_DURATION} onDone={dismiss} />
        </div>
    );
}

// ── Container (mount once in app shell) ──────────────────────────────────────

export function NotificationToastContainer() {
    const [items, setItems] = useState<ToastItem[]>([]);

    useEffect(() => {
        const listener: Listener = (newItems) => setItems(newItems);
        _listeners.add(listener);
        return () => { _listeners.delete(listener); };
    }, []);

    if (items.length === 0) return null;

    return (
        <div className="fixed top-6 right-6 z-[200] flex flex-col gap-2.5 pointer-events-none">
            {items.map((item) => (
                <div key={item.toastId} className="pointer-events-auto">
                    <NotificationToastCard
                        item={item}
                        onDismiss={() => dismissToast(item.toastId)}
                    />
                </div>
            ))}
        </div>
    );
}
