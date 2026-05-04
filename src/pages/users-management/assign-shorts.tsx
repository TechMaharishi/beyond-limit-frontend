import { useEffect, useMemo, useState } from "react";
import {
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    Layers,
    Loader2,
    MoreHorizontal,
    Search,
    Trash2,
    Users,
    Video,
} from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
    useAssignableUsersForShorts,
    useAssignShortsBulk,
    usePublishedShortVideos,
    useUnassignShort,
    useUserAssignedShorts,
    useUserProfilesForAssignment,
} from "@/hooks/use-assign-shorts";
import type { AssignableUser } from "@/services/assign-course.service";
import type { UserProfile } from "@/services/assign-shorts.service";

function getAssignableRoles(currentUserRole: string): ("trainee" | "user")[] {
    switch (currentUserRole) {
        case "admin":
        case "trainer":
            return ["trainee", "user"];
        case "trainee":
            return ["user"];
        default:
            return [];
    }
}

// ─── Profile Picker ───────────────────────────────────────────────────────────

interface ProfilePickerProps {
    profiles: UserProfile[];
    isLoading: boolean;
    selectedProfileId: string | null;
    onSelect: (id: string) => void;
}

function ProfilePicker({ profiles, isLoading, selectedProfileId, onSelect }: ProfilePickerProps) {
    if (isLoading) {
        return (
            <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading profiles…</span>
            </div>
        );
    }

    if (profiles.length === 0) {
        return (
            <p className="text-sm text-muted-foreground italic">
                This user has no profiles. Create one first in User Management.
            </p>
        );
    }

    return (
        <div className="flex flex-wrap gap-2">
            {profiles.map((p) => (
                <button
                    key={p._id}
                    type="button"
                    onClick={() => onSelect(p._id)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        selectedProfileId === p._id
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border hover:bg-muted/50"
                    }`}
                >
                    <Layers className="h-3.5 w-3.5" />
                    {p.name}
                    {p.isDefault && (
                        <span className="text-xs text-muted-foreground">(default)</span>
                    )}
                </button>
            ))}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssignShortsPage() {
    const { data: session } = authClient.useSession();
    const currentUserRole = session?.user?.role || "user";
    const assignableRoles = getAssignableRoles(currentUserRole);
    const [activeTab, setActiveTab] = useState<"trainee" | "user">(
        assignableRoles[0] || "user"
    );
    const isUserTab = activeTab === "user";

    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [sortBy, setSortBy] = useState("name");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<AssignableUser | null>(null);
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [selectedShortIds, setSelectedShortIds] = useState<string[]>([]);
    const [shortSearch, setShortSearch] = useState("");

    // Profile data — only fetched for Individual Learner (user) rows
    const { data: userProfiles = [], isLoading: isProfilesLoading } = useUserProfilesForAssignment(
        isUserTab && selectedUser ? selectedUser.id : null
    );

    // Auto-select the default profile when profiles load
    useEffect(() => {
        if (userProfiles.length > 0 && !selectedProfileId) {
            const def = userProfiles.find((p) => p.isDefault) ?? userProfiles[0];
            setSelectedProfileId(def._id);
        }
    }, [userProfiles]);

    const { data: usersData, isLoading: isUsersLoading } = useAssignableUsersForShorts(
        activeTab,
        { page, limit, search, sortBy, sortDirection },
        assignableRoles.length > 0
    );

    const [shortsPage, setShortsPage] = useState(1);
    const [shortsLimit, setShortsLimit] = useState(10);
    const { data: shortsData, isLoading: isShortsLoading } = usePublishedShortVideos({
        page: shortsPage,
        limit: shortsLimit,
        sortBy: "createdAt",
        order: "desc",
    });

    const [assignedPage, setAssignedPage] = useState(1);
    const [assignedLimit, setAssignedLimit] = useState(10);
    const { data: assignedShortsData, isLoading: isAssignedLoading } = useUserAssignedShorts(
        selectedUser?.id || null,
        {
            page: assignedPage,
            limit: assignedLimit,
            // Only pass profileId for user-role accounts
            ...(isUserTab && selectedProfileId ? { profileId: selectedProfileId } : {}),
        }
    );

    const bulkAssignMutation = useAssignShortsBulk();
    const unassignMutation = useUnassignShort();

    const users = useMemo(() => usersData?.users || [], [usersData]);
    const meta = usersData?.meta;
    const shorts = useMemo(() => shortsData?.shorts || [], [shortsData]);
    const shortsMeta = shortsData?.meta;
    const assignedShorts = useMemo(() => assignedShortsData?.shorts || [], [assignedShortsData]);
    const assignedMeta = assignedShortsData?.meta;

    const assignedShortIds = useMemo(
        () => new Set(assignedShorts.map((as) => as.short._id)),
        [assignedShorts]
    );

    const filteredShorts = useMemo(
        () =>
            shorts.filter((short) =>
                short.title.toLowerCase().includes(shortSearch.toLowerCase())
            ),
        [shorts, shortSearch]
    );

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortBy(field);
            setSortDirection("asc");
        }
    };

    const resetDialogState = () => {
        setSelectedShortIds([]);
        setShortSearch("");
        setAssignedPage(1);
        setSelectedProfileId(null);
    };

    const openAssignDialog = (user: AssignableUser) => {
        setSelectedUser(user);
        resetDialogState();
        setIsAssignDialogOpen(true);
    };

    const openViewDialog = (user: AssignableUser) => {
        setSelectedUser(user);
        resetDialogState();
        setIsViewDialogOpen(true);
    };

    const handleShortToggle = (shortId: string) => {
        setSelectedShortIds((prev) =>
            prev.includes(shortId) ? prev.filter((id) => id !== shortId) : [...prev, shortId]
        );
    };

    // Validate that profile is selected when required
    const requiresProfile = isUserTab;
    const profileReady = !requiresProfile || !!selectedProfileId;

    const handleAssignSubmit = async () => {
        if (!selectedUser || selectedShortIds.length === 0) return;
        if (requiresProfile && !selectedProfileId) {
            toast.error("Please select a profile to assign shorts to.");
            return;
        }

        try {
            await bulkAssignMutation.mutateAsync(
                selectedShortIds.map((shortVideoId) => ({
                    userId: selectedUser.id,
                    shortVideoId,
                    ...(requiresProfile && selectedProfileId ? { profileId: selectedProfileId } : {}),
                }))
            );
            toast.success("Shorts assigned successfully");
            setIsAssignDialogOpen(false);
            resetDialogState();
            setSelectedUser(null);
        } catch (error: unknown) {
            const msg =
                (error as any)?.response?.data?.message ?? "Failed to assign shorts";
            toast.error(msg);
        }
    };

    const handleUnassign = async (shortVideoId: string) => {
        if (!selectedUser) return;

        try {
            await unassignMutation.mutateAsync({
                userId: selectedUser.id,
                shortVideoId,
                ...(requiresProfile && selectedProfileId ? { profileId: selectedProfileId } : {}),
            });
            toast.success("Short unassigned successfully");
        } catch (error: unknown) {
            const msg =
                (error as any)?.response?.data?.message ?? "Failed to unassign short";
            toast.error(msg);
        }
    };

    if (assignableRoles.length === 0) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <Video className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h2 className="mt-4 text-lg font-semibold">Access Denied</h2>
                    <p className="text-muted-foreground">
                        You don't have permission to assign shorts.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-8 h-full flex flex-col">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Assign Shorts</h1>
                <p className="text-muted-foreground mt-1">
                    Assign short videos to Clinical Learners and Individual Learners.
                </p>
                <div className="mt-3">
                    <Tabs
                        value={activeTab}
                        onValueChange={(val) => {
                            setActiveTab(val as "trainee" | "user");
                            setPage(1);
                            setSearch("");
                        }}
                    >
                        <TabsList>
                            {assignableRoles.includes("trainee") && (
                                <TabsTrigger value="trainee">Clinical Learners</TabsTrigger>
                            )}
                            {assignableRoles.includes("user") && (
                                <TabsTrigger value="user">Individual Learners</TabsTrigger>
                            )}
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <div className="relative w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={`Search ${isUserTab ? "Individual Learners" : "Clinical Learners"}…`}
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="pl-8"
                    />
                </div>
            </div>

            {/* Users table */}
            <div className="rounded-md border bg-background overflow-hidden">
                <div className="max-h-[440px] overflow-auto relative w-full">
                    <table className="w-full caption-bottom text-sm border-collapse table-fixed">
                        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                            <TableRow className="hover:bg-transparent">
                                <TableHead
                                    className="w-[25%] bg-background py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSort("name")}
                                >
                                    <div className="flex items-center gap-1">
                                        User Details
                                        {sortBy === "name" && <ArrowUpDown className="h-3 w-3" />}
                                    </div>
                                </TableHead>
                                <TableHead className="w-[15%] bg-background py-2">Account Type</TableHead>
                                <TableHead className="w-[10%] bg-background py-2">Verified</TableHead>
                                <TableHead className="w-[10%] bg-background py-2">Status</TableHead>
                                <TableHead
                                    className="w-[20%] bg-background py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSort("createdAt")}
                                >
                                    <div className="flex items-center gap-1">
                                        Created At
                                        {sortBy === "createdAt" && <ArrowUpDown className="h-3 w-3" />}
                                    </div>
                                </TableHead>
                                <TableHead className="w-[20%] bg-background py-2 text-right" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isUsersLoading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={6} className="p-2">
                                            <Skeleton className="h-12 w-full" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <div className="flex h-40 items-center justify-center text-muted-foreground flex-col">
                                            <Users className="h-10 w-10 mb-2 opacity-20" />
                                            <p>
                                                {search
                                                    ? `No users found matching "${search}"`
                                                    : "No users found"}
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => (
                                    <TableRow key={user.id} className="hover:bg-muted/50">
                                        <TableCell className="py-2">
                                            <div className="flex flex-col truncate">
                                                <span className="font-medium truncate" title={user.name}>
                                                    {user.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground truncate" title={user.email}>
                                                    {user.email}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-2 capitalize">
                                            {user.accountType || "—"}
                                        </TableCell>
                                        <TableCell className="py-2">
                                            {user.emailVerified ? (
                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                                                    Verified
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">
                                                    Pending
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="py-2">
                                            {user.banned ? (
                                                <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-transparent shadow-none">
                                                    Banned
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-transparent shadow-none">
                                                    Active
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="py-2 text-muted-foreground text-sm">
                                            {formatRelativeTime(user.createdAt)}
                                        </TableCell>
                                        <TableCell className="py-2 text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => openAssignDialog(user)}>
                                                        <Video className="mr-2 h-4 w-4" />
                                                        Assign Shorts
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openViewDialog(user)}>
                                                        <Users className="mr-2 h-4 w-4" />
                                                        View Assigned Shorts
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    {isUsersLoading ? (
                        "Loading…"
                    ) : meta && meta.total > 0 ? (
                        <>
                            Showing {Math.min((meta.page - 1) * meta.limit + 1, meta.total)} to{" "}
                            {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} users
                        </>
                    ) : (
                        "Showing 0 to 0 of 0 users"
                    )}
                </div>
                <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2 mr-4">
                        <span className="text-sm text-muted-foreground">Rows per page</span>
                        <Select
                            value={limit.toString()}
                            onValueChange={(val) => { setLimit(Number(val)); setPage(1); }}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue placeholder={limit} />
                            </SelectTrigger>
                            <SelectContent side="top">
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="20">20</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        variant="outline" size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={!meta?.hasPrev || isUsersLoading}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <div className="text-sm font-medium">
                        Page {meta?.page || 1} of {meta?.totalPages || 1}
                    </div>
                    <Button
                        variant="outline" size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={!meta?.hasNext || isUsersLoading}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* ── Assign Dialog ── */}
            <Dialog open={isAssignDialogOpen} onOpenChange={(open) => { if (!open) { setIsAssignDialogOpen(false); resetDialogState(); } }}>
                <DialogContent className="sm:max-w-[900px] h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Assign Shorts</DialogTitle>
                        <DialogDescription>
                            Select short videos to assign to{" "}
                            <span className="font-medium text-foreground">{selectedUser?.name}</span>
                        </DialogDescription>
                    </DialogHeader>

                    {selectedUser && (
                        <div className="flex-1 flex flex-col gap-4 overflow-hidden p-1">
                            {/* Profile picker — only for Individual Learners */}
                            {isUserTab && (
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-1.5">
                                        <Layers className="h-4 w-4" />
                                        Assign to Profile
                                        <span className="text-destructive">*</span>
                                    </Label>
                                    <ProfilePicker
                                        profiles={userProfiles}
                                        isLoading={isProfilesLoading}
                                        selectedProfileId={selectedProfileId}
                                        onSelect={setSelectedProfileId}
                                    />
                                    {userProfiles.length > 0 && !selectedProfileId && (
                                        <p className="text-xs text-destructive">Select a profile to continue.</p>
                                    )}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Search Shorts</Label>
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search available shorts…"
                                        value={shortSearch}
                                        onChange={(e) => setShortSearch(e.target.value)}
                                        className="pl-8"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col min-h-0 gap-2">
                                <Label>
                                    Shorts ({filteredShorts.length})
                                    {isAssignedLoading && (
                                        <span className="ml-2 text-muted-foreground font-normal text-xs">
                                            checking assignments…
                                        </span>
                                    )}
                                    {!isAssignedLoading && assignedShortIds.size > 0 && (
                                        <span className="ml-2 text-muted-foreground font-normal text-xs">
                                            • {assignedShortIds.size} assigned
                                        </span>
                                    )}
                                    {selectedShortIds.length > 0 && (
                                        <span className="ml-2 text-primary font-normal text-xs">
                                            • {selectedShortIds.length} selected
                                        </span>
                                    )}
                                </Label>
                                <div className="flex-1 min-h-0 border rounded-md overflow-hidden relative">
                                    <div className="absolute inset-0 overflow-y-auto">
                                        {isShortsLoading ? (
                                            <div className="p-4 space-y-2">
                                                {Array.from({ length: 6 }).map((_, i) => (
                                                    <Skeleton key={i} className="h-12 w-full" />
                                                ))}
                                            </div>
                                        ) : filteredShorts.length === 0 ? (
                                            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                                                <div className="text-center">
                                                    <Video className="mx-auto h-8 w-8 opacity-20" />
                                                    <p className="mt-2">
                                                        {shortSearch ? "No shorts found matching search" : "No published shorts available"}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-2 space-y-2">
                                                {filteredShorts.map((short) => {
                                                    const alreadyAssigned = assignedShortIds.has(short._id);
                                                    const isSelected = selectedShortIds.includes(short._id);
                                                    return (
                                                        <div
                                                            key={short._id}
                                                            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                                                                alreadyAssigned
                                                                    ? "opacity-60 bg-muted/30 cursor-not-allowed"
                                                                    : isSelected
                                                                    ? "bg-primary/5 border-primary cursor-pointer"
                                                                    : "hover:bg-muted/50 cursor-pointer"
                                                            }`}
                                                            onClick={() => !alreadyAssigned && handleShortToggle(short._id)}
                                                        >
                                                            <Checkbox
                                                                checked={isSelected || alreadyAssigned}
                                                                disabled={alreadyAssigned}
                                                                className="mt-1"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="font-medium truncate" title={short.title}>
                                                                        {short.title}
                                                                    </h4>
                                                                    {alreadyAssigned && (
                                                                        <Badge className="text-xs shrink-0 bg-emerald-100 text-emerald-800 border-transparent shadow-none hover:bg-emerald-100">
                                                                            Assigned
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm text-muted-foreground line-clamp-1">
                                                                    {short.description}
                                                                </p>
                                                                <div className="mt-1 flex items-center gap-1 flex-wrap">
                                                                    <Badge variant="outline" className="text-xs capitalize">
                                                                        {short.accessLevel}
                                                                    </Badge>
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {Math.round(short.durationSeconds)}s
                                                                    </Badge>
                                                                    {short.tags.slice(0, 3).map((tag) => (
                                                                        <Badge key={tag} variant="outline" className="text-xs">
                                                                            {tag}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            {short.thumbnailUrl && (
                                                                <img
                                                                    src={short.thumbnailUrl}
                                                                    alt=""
                                                                    className="w-28 h-20 object-cover rounded shrink-0"
                                                                />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Shorts pagination */}
                                <div className="flex items-center justify-between pt-1">
                                    <div className="text-sm text-muted-foreground">
                                        {isShortsLoading ? "Loading…" : shortsMeta && shortsMeta.total > 0 ? (
                                            <>
                                                Showing {Math.min((shortsMeta.page - 1) * shortsMeta.limit + 1, shortsMeta.total)}{" "}
                                                to {Math.min(shortsMeta.page * shortsMeta.limit, shortsMeta.total)} of {shortsMeta.total} shorts
                                            </>
                                        ) : "Showing 0 of 0 shorts"}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Select
                                            value={shortsLimit.toString()}
                                            onValueChange={(val) => { setShortsLimit(Number(val)); setShortsPage(1); }}
                                        >
                                            <SelectTrigger className="h-8 w-[70px]">
                                                <SelectValue placeholder={shortsLimit} />
                                            </SelectTrigger>
                                            <SelectContent side="top">
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="20">20</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Button variant="outline" size="sm"
                                            onClick={() => setShortsPage((p) => Math.max(1, p - 1))}
                                            disabled={!shortsMeta?.hasPrev || isShortsLoading}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="text-sm font-medium">
                                            {shortsMeta?.page || 1} / {shortsMeta?.totalPages || 1}
                                        </span>
                                        <Button variant="outline" size="sm"
                                            onClick={() => setShortsPage((p) => p + 1)}
                                            disabled={!shortsMeta?.hasNext || isShortsLoading}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsAssignDialogOpen(false); resetDialogState(); }} disabled={bulkAssignMutation.isPending}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAssignSubmit}
                            disabled={selectedShortIds.length === 0 || bulkAssignMutation.isPending || !profileReady}
                        >
                            {bulkAssignMutation.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Assign {selectedShortIds.length > 0 && `(${selectedShortIds.length})`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── View Assigned Dialog ── */}
            <Dialog open={isViewDialogOpen} onOpenChange={(open) => { if (!open) { setIsViewDialogOpen(false); resetDialogState(); } }}>
                <DialogContent className="sm:max-w-[900px] h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Assigned Shorts</DialogTitle>
                        <DialogDescription>
                            Short videos assigned to{" "}
                            <span className="font-medium text-foreground">{selectedUser?.name}</span>
                        </DialogDescription>
                    </DialogHeader>

                    {selectedUser && (
                        <div className="flex-1 flex flex-col gap-4 overflow-hidden p-1">
                            {/* Profile picker — only for Individual Learners */}
                            {isUserTab && (
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-1.5">
                                        <Layers className="h-4 w-4" />
                                        Viewing profile
                                    </Label>
                                    <ProfilePicker
                                        profiles={userProfiles}
                                        isLoading={isProfilesLoading}
                                        selectedProfileId={selectedProfileId}
                                        onSelect={setSelectedProfileId}
                                    />
                                </div>
                            )}

                            <div className="flex-1 min-h-0 border rounded-md overflow-hidden relative">
                                <div className="absolute inset-0 overflow-y-auto">
                                    {isAssignedLoading ? (
                                        <div className="space-y-2 p-3">
                                            {Array.from({ length: 6 }).map((_, i) => (
                                                <Skeleton key={i} className="h-20 w-full" />
                                            ))}
                                        </div>
                                    ) : !profileReady ? (
                                        <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                                            <div className="text-center">
                                                <Layers className="mx-auto h-8 w-8 opacity-20" />
                                                <p className="mt-2">Select a profile above to view assigned shorts.</p>
                                            </div>
                                        </div>
                                    ) : assignedShorts.length === 0 ? (
                                        <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                                            <div className="text-center">
                                                <Video className="mx-auto h-8 w-8 opacity-20" />
                                                <p className="mt-2">No shorts assigned yet</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 p-3">
                                            {assignedShorts.map((assignment) => (
                                                <div
                                                    key={assignment.short._id}
                                                    className="flex items-start gap-3 p-3 rounded-lg border"
                                                >
                                                    {assignment.short.thumbnailUrl && (
                                                        <img
                                                            src={assignment.short.thumbnailUrl}
                                                            alt=""
                                                            className="w-28 h-20 object-cover rounded shrink-0"
                                                        />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium truncate">{assignment.short.title}</h4>
                                                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                                            <span>Assigned by {assignment.assignedBy.name}</span>
                                                            <span>•</span>
                                                            <span>{formatRelativeTime(assignment.assignedAt)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <Progress
                                                                value={assignment.progress.percentCompleted}
                                                                className="h-2 flex-1"
                                                            />
                                                            <span className="text-xs text-muted-foreground w-10 text-right">
                                                                {assignment.progress.percentCompleted}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                                        onClick={() => handleUnassign(assignment.short._id)}
                                                        disabled={unassignMutation.isPending}
                                                    >
                                                        {unassignMutation.isPending ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Assigned shorts pagination */}
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-muted-foreground">
                                    {isAssignedLoading ? "Loading…" : assignedMeta && assignedMeta.total > 0 ? (
                                        <>
                                            Showing {Math.min((assignedMeta.page - 1) * assignedMeta.limit + 1, assignedMeta.total)}{" "}
                                            to {Math.min(assignedMeta.page * assignedMeta.limit, assignedMeta.total)} of {assignedMeta.total} shorts
                                        </>
                                    ) : "Showing 0 of 0 shorts"}
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Select
                                        value={assignedLimit.toString()}
                                        onValueChange={(val) => { setAssignedLimit(Number(val)); setAssignedPage(1); }}
                                    >
                                        <SelectTrigger className="h-8 w-[70px]">
                                            <SelectValue placeholder={assignedLimit} />
                                        </SelectTrigger>
                                        <SelectContent side="top">
                                            <SelectItem value="10">10</SelectItem>
                                            <SelectItem value="20">20</SelectItem>
                                            <SelectItem value="50">50</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline" size="sm"
                                        onClick={() => setAssignedPage((p) => Math.max(1, p - 1))}
                                        disabled={!assignedMeta?.hasPrev || isAssignedLoading}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-sm font-medium">
                                        {assignedMeta?.page || 1} / {assignedMeta?.totalPages || 1}
                                    </span>
                                    <Button variant="outline" size="sm"
                                        onClick={() => setAssignedPage((p) => p + 1)}
                                        disabled={!assignedMeta?.hasNext || isAssignedLoading}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <Button
                                className="w-full"
                                variant="outline"
                                onClick={() => {
                                    setIsViewDialogOpen(false);
                                    openAssignDialog(selectedUser);
                                }}
                            >
                                <Video className="mr-2 h-4 w-4" />
                                Assign More Shorts
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
