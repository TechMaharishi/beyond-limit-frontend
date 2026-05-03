import { useMemo, useState } from "react";
import {
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
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

import {
    useAssignableUsersForShorts,
    useAssignShortsBulk,
    usePublishedShortVideos,
    useUnassignShort,
    useUserAssignedShorts,
} from "@/hooks/use-assign-shorts";
import type { AssignableUser } from "@/services/assign-course.service";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

export default function AssignShortsPage() {
    const { data: session } = authClient.useSession();
    const currentUserRole = session?.user?.role || "user";
    const assignableRoles = getAssignableRoles(currentUserRole);
    const [activeTab, setActiveTab] = useState<"trainee" | "user">(
        assignableRoles[0] || "user"
    );

    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [sortBy, setSortBy] = useState("name");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

    const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<AssignableUser | null>(null);
    const [selectedShortIds, setSelectedShortIds] = useState<string[]>([]);
    const [shortSearch, setShortSearch] = useState("");

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
        { page: assignedPage, limit: assignedLimit }
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

    const filteredShorts = useMemo(() => {
        return shorts.filter((short) => {
            const matchesSearch = short.title
                .toLowerCase()
                .includes(shortSearch.toLowerCase());
            const notAssigned = !assignedShortIds.has(short._id);
            return matchesSearch && notAssigned;
        });
    }, [shorts, shortSearch, assignedShortIds]);

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortBy(field);
            setSortDirection("asc");
        }
    };

    const openAssignDialog = (user: AssignableUser) => {
        setSelectedUser(user);
        setSelectedShortIds([]);
        setShortSearch("");
        setAssignedPage(1);
        setIsAssignDialogOpen(true);
    };

    const openViewDialog = (user: AssignableUser) => {
        setSelectedUser(user);
        setAssignedPage(1);
        setIsViewDialogOpen(true);
    };

    const handleShortToggle = (shortId: string) => {
        setSelectedShortIds((prev) =>
            prev.includes(shortId) ? prev.filter((id) => id !== shortId) : [...prev, shortId]
        );
    };

    const handleAssignSubmit = async () => {
        if (!selectedUser || selectedShortIds.length === 0) return;

        try {
            await bulkAssignMutation.mutateAsync(
                selectedShortIds.map((shortVideoId) => ({
                    userId: selectedUser.id,
                    shortVideoId,
                }))
            );

            toast.success("Shorts Assigned");

            setIsAssignDialogOpen(false);
            setSelectedUser(null);
            setSelectedShortIds([]);
        } catch (error: unknown) {
            const message =
                typeof error === "object" &&
                error !== null &&
                "response" in error &&
                (error as { response?: { data?: { message?: string } } }).response?.data?.message
                    ? (error as { response?: { data?: { message?: string } } }).response!.data!.message!
                    : "Failed to assign shorts";
            toast.error(message);
        }
    };

    const handleUnassign = async (shortVideoId: string) => {
        if (!selectedUser) return;

        try {
            await unassignMutation.mutateAsync({ userId: selectedUser.id, shortVideoId });
            toast.success("Short unassigned successfully");
        } catch (error: unknown) {
            const message =
                typeof error === "object" &&
                error !== null &&
                "response" in error &&
                (error as { response?: { data?: { message?: string } } }).response?.data?.message
                    ? (error as { response?: { data?: { message?: string } } }).response!.data!.message!
                    : "Failed to unassign short";
            toast.error(message);
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
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Assign Shorts</h1>
                <p className="text-muted-foreground mt-1">
                    Assign short videos to Clinical Learners and Individual Learners.
                </p>
                <div className="mt-3">
                    <Tabs value={activeTab} onValueChange={(val) => {
                        setActiveTab(val as "trainee" | "user");
                        setPage(1);
                    }}>
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

            <div className="flex items-center justify-between">
                <div className="relative w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search Individual Learners..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="pl-8"
                    />
                </div>
            </div>

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
                                <TableHead className="w-[15%] bg-background py-2">
                                    Account Type
                                </TableHead>
                                <TableHead className="w-[10%] bg-background py-2">
                                    Verified
                                </TableHead>
                                <TableHead className="w-[10%] bg-background py-2">
                                    Status
                                </TableHead>
                                <TableHead
                                    className="w-[20%] bg-background py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSort("createdAt")}
                                >
                                    <div className="flex items-center gap-1">
                                        Created At
                                        {sortBy === "createdAt" && <ArrowUpDown className="h-3 w-3" />}
                                    </div>
                                </TableHead>
                                <TableHead className="w-[20%] bg-background py-2 text-right"></TableHead>
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
                                    <TableRow
                                        key={user.id}
                                        className="cursor-pointer hover:bg-muted/50"
                                    >
                                        <TableCell className="w-[25%] py-2">
                                            <div className="flex flex-col truncate">
                                                <span className="font-medium truncate" title={user.name}>
                                                    {user.name}
                                                </span>
                                                <span
                                                    className="text-xs text-muted-foreground truncate"
                                                    title={user.email}
                                                >
                                                    {user.email}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[15%] py-2 capitalize">
                                            {user.accountType || "-"}
                                        </TableCell>
                                        <TableCell className="w-[10%] py-2">
                                            {user.emailVerified ? (
                                                <Badge
                                                    variant="outline"
                                                    className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                                >
                                                    Verified
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="outline"
                                                    className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50"
                                                >
                                                    Pending
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="w-[10%] py-2">
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
                                        <TableCell className="w-[20%] py-2 text-muted-foreground text-sm">
                                            {formatRelativeTime(user.createdAt)}
                                        </TableCell>
                                        <TableCell className="w-[20%] py-2 text-right">
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

            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    {isUsersLoading ? (
                        "Loading..."
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
                            onValueChange={(val) => {
                                setLimit(Number(val));
                                setPage(1);
                            }}
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
                        variant="outline"
                        size="sm"
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
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={!meta?.hasNext || isUsersLoading}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                <DialogContent className="sm:max-w-[900px] h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Assign Shorts</DialogTitle>
                        <DialogDescription>
                            Select short videos to assign to {selectedUser?.name}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedUser && (
                        <div className="flex-1 flex flex-col gap-4 overflow-hidden p-1">
                            <div className="space-y-2">
                                <Label>Search Shorts</Label>
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search available shorts..."
                                        value={shortSearch}
                                        onChange={(e) => setShortSearch(e.target.value)}
                                        className="pl-8"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col min-h-0 gap-2">
                                <Label>
                                    Available Shorts ({filteredShorts.length})
                                    {selectedShortIds.length > 0 && (
                                        <span className="ml-2 text-primary">
                                            • {selectedShortIds.length} selected
                                        </span>
                                    )}
                                </Label>
                                <div className="flex-1 min-h-0 border rounded-md overflow-hidden relative">
                                    <div className="absolute inset-0 overflow-y-auto">
                                        {isShortsLoading || isAssignedLoading ? (
                                            <div className="p-4 space-y-2">
                                                {Array.from({ length: 8 }).map((_, i) => (
                                                    <Skeleton key={i} className="h-12 w-full" />
                                                ))}
                                            </div>
                                        ) : filteredShorts.length === 0 ? (
                                            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                                                <div className="text-center">
                                                    <Video className="mx-auto h-8 w-8 opacity-20" />
                                                    <p className="mt-2">
                                                        {shortSearch
                                                            ? "No shorts found matching search"
                                                            : "No available shorts to assign"}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-2 space-y-2">
                                                {filteredShorts.map((short) => (
                                                    <div
                                                        key={short._id}
                                                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedShortIds.includes(short._id)
                                                                ? "bg-primary/5 border-primary"
                                                                : "hover:bg-muted/50"
                                                            }`}
                                                        onClick={() => handleShortToggle(short._id)}
                                                    >
                                                        <Checkbox
                                                            checked={selectedShortIds.includes(short._id)}
                                                            className="mt-1"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-medium truncate" title={short.title}>
                                                                {short.title.length > 20
                                                                    ? short.title.slice(0, 20) + "..."
                                                                    : short.title}
                                                            </h4>
                                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                                                {short.description.length > 50
                                                                    ? short.description.slice(0, 50) + "..."
                                                                    : short.description}
                                                            </p>
                                                            <div className="mt-1 flex items-center gap-1 flex-wrap">
                                                                <Badge variant="outline" className="text-xs capitalize">
                                                                    {short.accessLevel}
                                                                </Badge>
                                                                <Badge variant="outline" className="text-xs">
                                                                    {Math.round(short.durationSeconds)}s
                                                                </Badge>
                                                                {short.tags.slice(0, 3).map((tag) => (
                                                                    <Badge
                                                                        key={tag}
                                                                        variant="outline"
                                                                        className="text-xs"
                                                                    >
                                                                        {tag}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        {short.thumbnailUrl && (
                                                            <img
                                                                src={short.thumbnailUrl}
                                                                alt=""
                                                                className="w-28 h-20 object-cover rounded"
                                                            />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <div className="text-sm text-muted-foreground">
                                        {isShortsLoading ? (
                                            "Loading..."
                                        ) : shortsMeta && shortsMeta.total > 0 ? (
                                            <>
                                                Showing{" "}
                                                {Math.min(
                                                    (shortsMeta.page - 1) * shortsMeta.limit + 1,
                                                    shortsMeta.total
                                                )}{" "}
                                                to {Math.min(shortsMeta.page * shortsMeta.limit, shortsMeta.total)} of{" "}
                                                {shortsMeta.total} shorts
                                            </>
                                        ) : (
                                            "Showing 0 to 0 of 0 shorts"
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className="flex items-center space-x-2 mr-4">
                                            <span className="text-sm text-muted-foreground">
                                                Rows per page
                                            </span>
                                            <Select
                                                value={shortsLimit.toString()}
                                                onValueChange={(val) => {
                                                    setShortsLimit(Number(val));
                                                    setShortsPage(1);
                                                }}
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
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShortsPage((p) => Math.max(1, p - 1))}
                                            disabled={!shortsMeta?.hasPrev || isShortsLoading}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Previous
                                        </Button>
                                        <div className="text-sm font-medium">
                                            Page {shortsMeta?.page || 1} of {shortsMeta?.totalPages || 1}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShortsPage((p) => p + 1)}
                                            disabled={!shortsMeta?.hasNext || isShortsLoading}
                                        >
                                            Next
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setIsAssignDialogOpen(false)}
                            disabled={bulkAssignMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAssignSubmit}
                            disabled={selectedShortIds.length === 0 || bulkAssignMutation.isPending}
                        >
                            {bulkAssignMutation.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Assign {selectedShortIds.length > 0 && `(${selectedShortIds.length})`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className="sm:max-w-[900px] h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Assigned Shorts</DialogTitle>
                        <DialogDescription>
                            Short videos assigned to {selectedUser?.name}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedUser && (
                        <div className="flex-1 flex flex-col gap-4 overflow-hidden p-1">
                            <div className="flex-1 min-h-0 border rounded-md overflow-hidden relative">
                                <div className="absolute inset-0 overflow-y-auto">
                                    {isAssignedLoading ? (
                                        <div className="space-y-2">
                                            {Array.from({ length: 8 }).map((_, i) => (
                                                <Skeleton key={i} className="h-12 w-full" />
                                            ))}
                                        </div>
                                    ) : assignedShorts.length === 0 ? (
                                        <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                                            <div className="text-center">
                                                <Video className="mx-auto h-8 w-8 opacity-20" />
                                                <p className="mt-2">No shorts assigned yet</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {assignedShorts.map((assignment) => (
                                                <div
                                                    key={assignment.short._id}
                                                    className="flex items-start gap-3 p-3 rounded-lg border"
                                                >
                                                    {assignment.short.thumbnailUrl && (
                                                        <img
                                                            src={assignment.short.thumbnailUrl}
                                                            alt=""
                                                            className="w-28 h-20 object-cover rounded"
                                                        />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium truncate">
                                                            {assignment.short.title}
                                                        </h4>
                                                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                                            <span>
                                                                Assigned by {assignment.assignedBy.name}
                                                            </span>
                                                            <span>•</span>
                                                            <span>{formatRelativeTime(assignment.assignedAt)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <Progress
                                                                value={assignment.progress.percentCompleted}
                                                                className="h-2 flex-1"
                                                            />
                                                            <span className="text-xs text-muted-foreground w-14 text-right">
                                                                {assignment.progress.percentCompleted}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
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

                            <div className="flex items-center justify-between pt-2">
                                <div className="text-sm text-muted-foreground">
                                    {isAssignedLoading ? (
                                        "Loading..."
                                    ) : assignedMeta && assignedMeta.total > 0 ? (
                                        <>
                                            Showing{" "}
                                            {Math.min(
                                                (assignedMeta.page - 1) * assignedMeta.limit + 1,
                                                assignedMeta.total
                                            )}{" "}
                                            to {Math.min(assignedMeta.page * assignedMeta.limit, assignedMeta.total)} of{" "}
                                            {assignedMeta.total} shorts
                                        </>
                                    ) : (
                                        "Showing 0 to 0 of 0 shorts"
                                    )}
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="flex items-center space-x-2 mr-4">
                                        <span className="text-sm text-muted-foreground">Rows per page</span>
                                        <Select
                                            value={assignedLimit.toString()}
                                            onValueChange={(val) => {
                                                setAssignedLimit(Number(val));
                                                setAssignedPage(1);
                                            }}
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
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setAssignedPage((p) => Math.max(1, p - 1))}
                                        disabled={!assignedMeta?.hasPrev || isAssignedLoading}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Previous
                                    </Button>
                                    <div className="text-sm font-medium">
                                        Page {assignedMeta?.page || 1} of {assignedMeta?.totalPages || 1}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setAssignedPage((p) => p + 1)}
                                        disabled={!assignedMeta?.hasNext || isAssignedLoading}
                                    >
                                        Next
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
