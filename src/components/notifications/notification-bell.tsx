import { Bell, Trash2, CheckCheck, Loader2, X } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    useNotifications,
    useMarkNotificationRead,
    useMarkAllNotificationsRead,
    useDeleteNotification,
    useClearAllNotifications,
} from "@/hooks/use-notifications";
import type { Notification } from "@/services/notifications.service";

const EVENT_LABELS: Record<string, string> = {
    "support-ticket-created": "Support Ticket",
    "clinical-assigned": "Clinical Assignment",
    "course-assigned": "Course Assigned",
    "course-video-added": "Course Updated",
    "short-assigned": "Short Video Assigned",
    "short-video-status": "Short Video Update",
};

function NotificationItem({
    notification,
    onRead,
    onDelete,
}: {
    notification: Notification;
    onRead: (id: string) => void;
    onDelete: (id: string) => void;
}) {
    const event = notification.data?.event;
    const label = event ? EVENT_LABELS[event] : undefined;

    return (
        <div
            className={`relative flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
                !notification.read ? "bg-primary/5" : ""
            }`}
        >
            {!notification.read && (
                <span className="absolute left-1.5 top-4 h-1.5 w-1.5 rounded-full bg-primary" />
            )}

            <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug line-clamp-1">
                        {notification.title}
                    </p>
                    {label && (
                        <Badge variant="outline" className="text-[10px] shrink-0 px-1.5 py-0">
                            {label}
                        </Badge>
                    )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{notification.body}</p>
                <p className="text-[11px] text-muted-foreground/70">
                    {formatRelativeTime(notification.createdAt)}
                </p>
            </div>

            <div className="flex flex-col gap-1 shrink-0">
                {!notification.read && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        title="Mark as read"
                        onClick={() => onRead(notification._id)}
                    >
                        <CheckCheck className="h-3.5 w-3.5" />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    title="Delete"
                    onClick={() => onDelete(notification._id)}
                >
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    );
}

export function NotificationBell() {
    const { data: notifications = [], isLoading } = useNotifications({ limit: 50 });
    const markRead = useMarkNotificationRead();
    const markAllRead = useMarkAllNotificationsRead();
    const deleteNotif = useDeleteNotification();
    const clearAll = useClearAllNotifications();

    const unreadCount = notifications.filter((n) => !n.read).length;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n._id);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>

            <PopoverContent align="end" sideOffset={8} className="w-[380px] p-0 shadow-lg">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">Notifications</h3>
                        {unreadCount > 0 && (
                            <Badge className="h-5 px-1.5 text-[10px]">{unreadCount} new</Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => markAllRead.mutate(unreadIds)}
                                disabled={markAllRead.isPending}
                            >
                                {markAllRead.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <CheckCheck className="h-3 w-3" />
                                )}
                                Mark all read
                            </Button>
                        )}
                        {notifications.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-destructive hover:text-destructive gap-1"
                                onClick={() => clearAll.mutate()}
                                disabled={clearAll.isPending}
                            >
                                {clearAll.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                    <Trash2 className="h-3 w-3" />
                                )}
                                Clear all
                            </Button>
                        )}
                    </div>
                </div>

                <ScrollArea className="max-h-[420px]">
                    {isLoading ? (
                        <div className="p-4 space-y-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="flex gap-3">
                                    <div className="flex-1 space-y-1.5">
                                        <Skeleton className="h-3.5 w-3/4" />
                                        <Skeleton className="h-3 w-full" />
                                        <Skeleton className="h-3 w-1/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                            <Bell className="h-8 w-8 opacity-20" />
                            <p className="text-sm">No notifications</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notification) => (
                                <NotificationItem
                                    key={notification._id}
                                    notification={notification}
                                    onRead={(id) => markRead.mutate(id)}
                                    onDelete={(id) => deleteNotif.mutate(id)}
                                />
                            ))}
                        </div>
                    )}
                </ScrollArea>

                {notifications.length > 0 && (
                    <>
                        <Separator />
                        <p className="px-4 py-2 text-center text-xs text-muted-foreground">
                            {notifications.length} notification{notifications.length !== 1 ? "s" : ""}{" "}
                            · auto-deleted after 30 days
                        </p>
                    </>
                )}
            </PopoverContent>
        </Popover>
    );
}
