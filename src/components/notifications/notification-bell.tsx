import { Bell, Trash2, CheckCheck, Loader2, BookOpen, Play, Stethoscope, Ticket, Video, Inbox } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
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

// ── Event config ──────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    "support-ticket-created": { label: "Support",     icon: Ticket,      color: "text-orange-500" },
    "clinical-assigned":      { label: "Clinical",    icon: Stethoscope, color: "text-teal-500"   },
    "course-assigned":        { label: "Course",      icon: BookOpen,    color: "text-blue-500"   },
    "course-video-added":     { label: "Course",      icon: Video,       color: "text-blue-500"   },
    "short-assigned":         { label: "Short",       icon: Play,        color: "text-purple-500" },
    "short-video-status":     { label: "Short",       icon: Play,        color: "text-purple-500" },
};

const DEFAULT_CONFIG = { label: "System", icon: Bell, color: "text-muted-foreground" };

// ── Single notification row ───────────────────────────────────────────────────

function NotificationItem({
    notification,
    onRead,
    onDelete,
}: {
    notification: Notification;
    onRead: (id: string) => void;
    onDelete: (id: string) => void;
}) {
    const cfg = EVENT_CONFIG[notification.data?.event ?? ""] ?? DEFAULT_CONFIG;
    const Icon = cfg.icon;

    return (
        <div
            className={cn(
                "group relative flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50",
                !notification.read && "bg-primary/[0.04]"
            )}
            onClick={() => { if (!notification.read) onRead(notification._id); }}
        >
            {/* Unread indicator */}
            {!notification.read && (
                <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full bg-primary" />
            )}

            {/* Icon */}
            <div className={cn(
                "mt-0.5 size-7 rounded-full flex items-center justify-center shrink-0",
                notification.read ? "bg-muted" : "bg-primary/10"
            )}>
                <Icon className={cn("size-3.5", notification.read ? "text-muted-foreground" : cfg.color)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                        "text-sm leading-snug line-clamp-1",
                        notification.read ? "font-normal text-foreground/80" : "font-semibold"
                    )}>
                        {notification.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0 mt-0.5 tabular-nums">
                        {formatRelativeTime(notification.createdAt)}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {notification.body}
                </p>
                {cfg.label && (
                    <Badge variant="outline" className="w-fit text-[10px] px-1.5 py-0 mt-0.5">
                        {cfg.label}
                    </Badge>
                )}
            </div>

            {/* Actions — show on hover */}
            <div className="flex flex-col gap-0.5 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {!notification.read && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-muted-foreground hover:text-primary"
                        title="Mark as read"
                        onClick={(e) => { e.stopPropagation(); onRead(notification._id); }}
                    >
                        <CheckCheck className="size-3" />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-muted-foreground hover:text-destructive"
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); onDelete(notification._id); }}
                >
                    <Trash2 className="size-3" />
                </Button>
            </div>
        </div>
    );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ label, count }: { label: string; count: number }) {
    return (
        <div className="flex items-center gap-2 px-4 py-2 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
            </span>
            <span className="text-[10px] text-muted-foreground/60">({count})</span>
        </div>
    );
}

// ── Bell button ───────────────────────────────────────────────────────────────

export function NotificationBell() {
    const { data: notifications = [], isLoading } = useNotifications({ limit: 50 });
    const markRead    = useMarkNotificationRead();
    const markAllRead = useMarkAllNotificationsRead();
    const deleteNotif = useDeleteNotification();
    const clearAll    = useClearAllNotifications();

    const unread = notifications.filter((n) => !n.read);
    const read   = notifications.filter((n) =>  n.read);
    const unreadCount = unread.length;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="size-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground leading-none">
                            {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>

            <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[400px] p-0 shadow-xl rounded-xl overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">Notifications</h3>
                        {unreadCount > 0 && (
                            <Badge className="h-5 px-1.5 text-[10px] rounded-full">
                                {unreadCount} new
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                                onClick={() => markAllRead.mutate(unread.map((n) => n._id))}
                                disabled={markAllRead.isPending}
                            >
                                {markAllRead.isPending
                                    ? <Loader2 className="size-3 animate-spin" />
                                    : <CheckCheck className="size-3" />
                                }
                                Mark all read
                            </Button>
                        )}
                        {notifications.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => clearAll.mutate()}
                                disabled={clearAll.isPending}
                            >
                                {clearAll.isPending
                                    ? <Loader2 className="size-3 animate-spin" />
                                    : <Trash2 className="size-3" />
                                }
                                Clear all
                            </Button>
                        )}
                    </div>
                </div>

                {/* Body */}
                <ScrollArea className="h-[440px]">
                    {isLoading ? (
                        <div className="flex flex-col gap-3 p-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="flex gap-3">
                                    <Skeleton className="size-7 rounded-full shrink-0" />
                                    <div className="flex-1 flex flex-col gap-1.5">
                                        <Skeleton className="h-3.5 w-3/4" />
                                        <Skeleton className="h-3 w-full" />
                                        <Skeleton className="h-3 w-1/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
                            <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                                <Inbox className="size-5 opacity-40" />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <p className="text-sm font-medium">All caught up</p>
                                <p className="text-xs text-muted-foreground/70">No notifications yet</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {unread.length > 0 && (
                                <>
                                    <SectionLabel label="New" count={unread.length} />
                                    <div className="flex flex-col">
                                        {unread.map((n) => (
                                            <NotificationItem
                                                key={n._id}
                                                notification={n}
                                                onRead={(id) => markRead.mutate(id)}
                                                onDelete={(id) => deleteNotif.mutate(id)}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}

                            {read.length > 0 && (
                                <>
                                    {unread.length > 0 && <Separator />}
                                    <SectionLabel label="Earlier" count={read.length} />
                                    <div className="flex flex-col">
                                        {read.map((n) => (
                                            <NotificationItem
                                                key={n._id}
                                                notification={n}
                                                onRead={(id) => markRead.mutate(id)}
                                                onDelete={(id) => deleteNotif.mutate(id)}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </ScrollArea>

                {/* Footer */}
                {notifications.length > 0 && (
                    <div className="px-4 py-2 border-t bg-muted/30 text-center">
                        <p className="text-[11px] text-muted-foreground/60">
                            {notifications.length} notification{notifications.length !== 1 ? "s" : ""} · auto-deleted after 30 days
                        </p>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
