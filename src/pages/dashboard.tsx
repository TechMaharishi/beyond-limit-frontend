import { useMemo, useState } from "react";
import type React from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
    Activity,
    BookOpen,
    GraduationCap,
    Users,
    ShieldAlert,
    Timer,
    Play,
    TicketCheck,
    TrendingUp,
    Flame,
    Lock,
    Settings,
    FileText,
    Database,
    ChevronRight,
    Globe,
} from "lucide-react";
import {
    useCompletionRate,
    useAssignmentSuccess,
    useTicketStats,
    useAccountTiers,
    useContentPopularity,
} from "@/hooks/use-kpi";
import {
    useAuditLogs,
    useAuditSummary,
    useAuditByCategory,
} from "@/hooks/use-audit";
import {
    Bar,
    BarChart,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { AuditLog } from "@/services/audit.service";

/* ─────────────────────────────────────────────
   Page shell
───────────────────────────────────────────── */
export function DashboardPage() {
    return (
        <div className="flex-1 flex flex-col gap-6 p-4 md:p-8 pt-6">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight">
                    Dashboard Overview
                </h1>
                <p className="text-muted-foreground text-sm">
                    Beyond Limits Learning Hub — admin analytics & compliance centre
                </p>
            </div>

            <Tabs defaultValue="kpi" className="flex flex-col gap-4">
                <TabsList className="w-fit">
                    <TabsTrigger value="kpi" className="flex items-center gap-2">
                        <TrendingUp className="size-4" />
                        KPI Analytics
                    </TabsTrigger>
                    <TabsTrigger value="audit" className="flex items-center gap-2">
                        <ShieldAlert className="size-4" />
                        Audit & Compliance
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="kpi" className="flex flex-col gap-6 mt-0">
                    <KPISection />
                </TabsContent>

                <TabsContent value="audit" className="flex flex-col gap-6 mt-0">
                    <AuditSection />
                </TabsContent>
            </Tabs>
        </div>
    );
}

/* ─────────────────────────────────────────────
   KPI SECTION
───────────────────────────────────────────── */
function KPISection() {
    const { data: completionData, isLoading: isCompletionLoading } = useCompletionRate();
    const { data: successData,    isLoading: isSuccessLoading }    = useAssignmentSuccess();
    const { data: ticketData,     isLoading: isTicketLoading }     = useTicketStats();
    const { data: tierData,       isLoading: isTierLoading }       = useAccountTiers();
    const { data: popularityData, isLoading: isPopularityLoading } = useContentPopularity();

    /* Transform monthly trend → grouped chart rows */
    const tierChartData = useMemo(() => {
        if (!tierData?.monthlyTrend) return [];
        const map = new Map<string, Record<string, number | string>>();
        for (const row of tierData.monthlyTrend) {
            const key = `${String(row.month).padStart(2, "0")}/${String(row.year).slice(2)}`;
            if (!map.has(key)) map.set(key, { month: key, free: 0, develop: 0, master: 0 });
            (map.get(key)!)[row.accountType] = row.count;
        }
        return Array.from(map.values());
    }, [tierData]);

    const tierChartConfig = {
        free:    { label: "Free",    color: "var(--color-chart-1)" },
        develop: { label: "Develop", color: "var(--color-chart-3)" },
        master:  { label: "Master",  color: "var(--color-chart-4)" },
    };

    const totalUsers = tierData?.currentSnapshot?.reduce((a, c) => a + c.count, 0) ?? 0;
    const newUsers   = tierData?.newInPeriod?.reduce((a, c) => a + c.newUsers, 0) ?? 0;

    return (
        <div className="flex flex-col gap-6">

            {/* ── Row 1: Six stat cards ── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <StatCard
                    title="Video Completion"
                    value={`${completionData?.courses?.completionRate?.toFixed(1) ?? 0}%`}
                    sub={`${completionData?.courses?.completed ?? 0} / ${completionData?.courses?.totalAssigned ?? 0} courses`}
                    icon={<GraduationCap className="size-4 text-muted-foreground" />}
                    loading={isCompletionLoading}
                />
                <StatCard
                    title="Short Completion"
                    value={`${completionData?.shorts?.completionRate?.toFixed(1) ?? 0}%`}
                    sub={`${completionData?.shorts?.completed ?? 0} / ${completionData?.shorts?.totalAssigned ?? 0} shorts`}
                    icon={<Play className="size-4 text-muted-foreground" />}
                    loading={isCompletionLoading}
                />
                <StatCard
                    title="Assignment Success"
                    value={`${successData?.courses?.successRate?.toFixed(1) ?? 0}%`}
                    sub={`${successData?.courses?.started ?? 0} of ${successData?.courses?.totalAssigned ?? 0} started`}
                    icon={<BookOpen className="size-4 text-muted-foreground" />}
                    loading={isSuccessLoading}
                />
                <StatCard
                    title="Short Engagement"
                    value={`${successData?.shorts?.successRate?.toFixed(1) ?? 0}%`}
                    sub={`${successData?.shorts?.started ?? 0} of ${successData?.shorts?.totalAssigned ?? 0} started`}
                    icon={<Activity className="size-4 text-muted-foreground" />}
                    loading={isSuccessLoading}
                />
                <StatCard
                    title="Ticket Volume"
                    value={ticketData?.resolution?.resolvedCount?.toString() ?? "0"}
                    sub={`${(ticketData?.byStatus?.find(s => s.status === "open")?.count ?? 0)} open tickets`}
                    icon={<TicketCheck className="size-4 text-muted-foreground" />}
                    loading={isTicketLoading}
                />
                <StatCard
                    title="Avg Resolution"
                    value={`${ticketData?.resolution?.avgHours?.toFixed(1) ?? 0}h`}
                    sub={`Min ${ticketData?.resolution?.minHours?.toFixed(1) ?? 0}h · Max ${ticketData?.resolution?.maxHours?.toFixed(1) ?? 0}h`}
                    icon={<Timer className="size-4 text-muted-foreground" />}
                    loading={isTicketLoading}
                />
            </div>

            {/* ── Row 2: User Account Tiers ── */}
            <div className="grid gap-4 lg:grid-cols-7">
                {/* Tier growth chart */}
                <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle>User Growth by Account Tier</CardTitle>
                        <CardDescription>Monthly new registrations — Free · Develop · Master</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isTierLoading ? (
                            <Skeleton className="h-[280px] w-full" />
                        ) : (
                            <ChartContainer config={tierChartConfig} className="h-[280px] w-full">
                                <BarChart data={tierChartData} barGap={2} barCategoryGap="30%">
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                                    <YAxis tickLine={false} axisLine={false} />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <ChartLegend content={<ChartLegendContent />} />
                                    <Bar dataKey="free"    fill="var(--color-free)"    radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="develop" fill="var(--color-develop)" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="master"  fill="var(--color-master)"  radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Tier snapshot */}
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Account Tier Snapshot</CardTitle>
                        <CardDescription>{totalUsers} total users · {newUsers} new (30 days)</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-5">
                        {isTierLoading ? (
                            <>
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </>
                        ) : (
                            (tierData?.currentSnapshot ?? [])
                                .filter(t => ["free", "develop", "master"].includes(t.accountType))
                                .map((tier) => {
                                    const newInTier = tierData?.newInPeriod?.find(n => n.accountType === tier.accountType)?.newUsers ?? 0;
                                    return (
                                        <div key={tier.accountType} className="flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <TierIcon tier={tier.accountType} />
                                                    <span className="text-sm font-medium capitalize">{tier.accountType}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground">+{newInTier} new</span>
                                                    <span className="text-sm font-bold">{tier.count}</span>
                                                </div>
                                            </div>
                                            <Progress value={tier.percentage} className="h-1.5" />
                                            <span className="text-xs text-muted-foreground">{tier.percentage.toFixed(1)}% of total</span>
                                        </div>
                                    );
                                })
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Row 3: Content Popularity & Stickiness ── */}
            <div className="grid gap-4 lg:grid-cols-2">
                <ContentPopularityCard
                    title="Top Courses"
                    description="Most assigned & watched courses"
                    icon={<BookOpen className="size-4 text-muted-foreground" />}
                    byAssignments={popularityData?.courses?.topByAssignments ?? []}
                    byWatchers={popularityData?.courses?.topByWatchers ?? []}
                    loading={isPopularityLoading}
                />
                <ContentPopularityCard
                    title="Top Shorts"
                    description="Most assigned & watched short videos"
                    icon={<Play className="size-4 text-muted-foreground" />}
                    byAssignments={popularityData?.shorts?.topByAssignments ?? []}
                    byWatchers={popularityData?.shorts?.topByWatchers ?? []}
                    loading={isPopularityLoading}
                />
            </div>

            {/* ── Row 4: Ticket type & status breakdown ── */}
            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Tickets by Status</CardTitle>
                        <CardDescription>Current open vs resolved distribution</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {isTicketLoading ? (
                            <Skeleton className="h-24 w-full" />
                        ) : (
                            (ticketData?.byStatus ?? []).map(s => (
                                <div key={s.status} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <TicketStatusBadge status={s.status} />
                                    </div>
                                    <span className="font-semibold tabular-nums">{s.count}</span>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Tickets by Type</CardTitle>
                        <CardDescription>Support request category breakdown</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {isTicketLoading ? (
                            <Skeleton className="h-24 w-full" />
                        ) : (
                            (ticketData?.byType ?? []).map(t => (
                                <div key={t.type} className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground capitalize">{t.type.replace(/_/g, " ")}</span>
                                    <Badge variant="secondary">{t.count}</Badge>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────
   AUDIT SECTION
───────────────────────────────────────────── */
function AuditSection() {
    const { data: summaryData, isLoading: isSummaryLoading } = useAuditSummary();

    const auditCategories = [
        { key: "auth",    label: "Authentication & Security", icon: Lock,     description: "Login, logout, password resets, 2FA events" },
        { key: "admin",   label: "Administrative & Org",      icon: Settings,  description: "Role changes, user management, org settings" },
        { key: "content", label: "Content Management",        icon: FileText,  description: "Course creation, edits, assignments, deletions" },
        { key: "support", label: "Data Integrity & Support",  icon: Database,  description: "Ticket events, data exports, integrity checks" },
    ] as const;

    return (
        <div className="flex flex-col gap-6">

            {/* Summary stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {auditCategories.map(({ key, label, icon: Icon }) => {
                    const cat = summaryData?.categoryBreakdown?.find(c => c.category === key);
                    return (
                        <Card key={key}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">{label}</CardTitle>
                                <Icon className="size-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                {isSummaryLoading ? (
                                    <Skeleton className="h-8 w-16" />
                                ) : (
                                    <>
                                        <div className="text-2xl font-bold">{cat?.count ?? 0}</div>
                                        <p className="text-xs text-muted-foreground">events in last 30 days</p>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Top actions summary */}
            <Card>
                <CardHeader>
                    <CardTitle>Top Actions (30 days)</CardTitle>
                    <CardDescription>Most frequent recorded events across all categories</CardDescription>
                </CardHeader>
                <CardContent>
                    {isSummaryLoading ? (
                        <div className="flex flex-col gap-3">
                            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {(summaryData?.topActions ?? []).map((a, i) => {
                                const max = summaryData!.topActions[0]?.count ?? 1;
                                return (
                                    <div key={a.action} className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
                                        <span className="text-sm flex-1 capitalize">{a.action.replace(/_/g, " ")}</span>
                                        <Progress value={(a.count / max) * 100} className="w-32 h-1.5" />
                                        <span className="text-sm font-semibold tabular-nums w-10 text-right">{a.count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Category-filtered log tabs */}
            <Tabs defaultValue="auth" className="flex flex-col gap-4">
                <TabsList className="w-fit flex-wrap h-auto gap-1">
                    {auditCategories.map(({ key, label, icon: Icon }) => (
                        <TabsTrigger key={key} value={key} className="flex items-center gap-1.5">
                            <Icon className="size-3.5" />
                            {label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {auditCategories.map(({ key, description }) => (
                    <TabsContent key={key} value={key} className="mt-0">
                        <AuditLogTable category={key} description={description} />
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}

/* ─────────────────────────────────────────────
   Audit log table (per-category)
───────────────────────────────────────────── */
function AuditLogTable({
    category,
    description,
}: {
    category: string;
    description: string;
}) {
    const { data, isLoading } = useAuditByCategory(category, { limit: 20 });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CategoryBadge category={category} />
                    <span className="capitalize">{category === "auth" ? "Authentication & Security" :
                        category === "admin" ? "Administrative & Organisation" :
                        category === "content" ? "Content Management" : "Data Integrity & Support"} Logs</span>
                </CardTitle>
                <CardDescription>{description} — immutable audit trail</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex flex-col gap-3">
                        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Action</TableHead>
                                <TableHead>Actor</TableHead>
                                <TableHead>Target</TableHead>
                                <TableHead>IP</TableHead>
                                <TableHead className="text-right">Timestamp</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(data?.data ?? []).map((log: AuditLog) => (
                                <TableRow key={log._id}>
                                    <TableCell>
                                        <span className="font-medium capitalize text-sm">
                                            {log.action.replace(/_/g, " ")}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm truncate max-w-[160px]">{log.actorEmail}</span>
                                            <Badge variant="outline" className="w-fit text-xs px-1.5 py-0">
                                                {log.actorRole}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {log.targetType ? (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <ChevronRight className="size-3" />
                                                <span>{log.targetType}</span>
                                                {log.targetId && <span className="font-mono">…{log.targetId.slice(-6)}</span>}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {log.ip ? (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Globe className="size-3" />
                                                {log.ip}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                                        {new Date(log.createdAt).toLocaleDateString("en-AU", {
                                            day: "2-digit", month: "short", year: "numeric",
                                        })}
                                        {" "}
                                        {new Date(log.createdAt).toLocaleTimeString("en-AU", {
                                            hour: "2-digit", minute: "2-digit",
                                        })}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {(!data?.data?.length) && (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-12 text-center">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <ShieldAlert className="size-8 opacity-20" />
                                            <p className="text-sm">No {category} audit logs found.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

/* ─────────────────────────────────────────────
   Content Popularity Card (reusable)
───────────────────────────────────────────── */
function ContentPopularityCard({
    title,
    description,
    icon,
    byAssignments,
    byWatchers,
    loading,
}: {
    title: string;
    description: string;
    icon: React.ReactNode;
    byAssignments: any[];
    byWatchers: any[];
    loading: boolean;
}) {
    const [view, setView] = useState<"assignments" | "watchers">("assignments");
    const rows = view === "assignments" ? byAssignments : byWatchers;
    const maxVal = Math.max(...rows.map(r => view === "assignments" ? (r.assignedCount ?? 0) : (r.watcherCount ?? 0)), 1);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                        <CardTitle className="flex items-center gap-2">
                            {icon}
                            {title}
                        </CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </div>
                    <Tabs value={view} onValueChange={v => setView(v as "assignments" | "watchers")}>
                        <TabsList className="h-7 text-xs">
                            <TabsTrigger value="assignments" className="text-xs px-2 h-6">Assigned</TabsTrigger>
                            <TabsTrigger value="watchers"   className="text-xs px-2 h-6">Watchers</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex flex-col gap-3">
                        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {rows.slice(0, 6).map((item: any, i: number) => {
                            const val = view === "assignments" ? (item.assignedCount ?? 0) : (item.watcherCount ?? 0);
                            return (
                                <div key={item._id ?? i} className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground w-4 shrink-0 tabular-nums">{i + 1}</span>
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        <Flame className={cn("size-3 shrink-0", i === 0 ? "text-primary" : "text-muted-foreground")} />
                                        <span className="text-sm truncate">{item.title}</span>
                                    </div>
                                    <Progress value={(val / maxVal) * 100} className="w-20 h-1.5 shrink-0" />
                                    <span className="text-sm font-semibold tabular-nums w-8 text-right shrink-0">{val}</span>
                                </div>
                            );
                        })}
                        {rows.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-6">No content data available.</p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/* ─────────────────────────────────────────────
   Small reusable components
───────────────────────────────────────────── */
function StatCard({
    title,
    value,
    sub,
    icon,
    loading,
}: {
    title: string;
    value: string;
    sub: string;
    icon: React.ReactNode;
    loading: boolean;
}) {
    return (
        <Card className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-7 w-20" />
                        <Skeleton className="h-3 w-28" />
                    </div>
                ) : (
                    <>
                        <div className="text-2xl font-bold">{value}</div>
                        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function TierIcon({ tier }: { tier: string }) {
    const map: Record<string, string> = {
        free: "bg-chart-1",
        develop: "bg-chart-3",
        master: "bg-chart-4",
    };
    return <div className={cn("size-2.5 rounded-full", map[tier] ?? "bg-muted")} />;
}

function CategoryBadge({ category }: { category: string }) {
    const map: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
        auth:    "destructive",
        admin:   "default",
        content: "secondary",
        support: "outline",
    };
    return <Badge variant={map[category] ?? "outline"}>{category}</Badge>;
}

function TicketStatusBadge({ status }: { status: string }) {
    const map: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
        open:       "destructive",
        in_progress: "default",
        resolved:   "secondary",
        closed:     "outline",
    };
    return (
        <Badge variant={map[status] ?? "outline"} className="capitalize">
            {status.replace(/_/g, " ")}
        </Badge>
    );
}
