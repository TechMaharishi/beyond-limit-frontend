import { useState, useEffect } from "react";
import {
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    Loader2,
    MoreHorizontal,
    Search,
    Stethoscope,
    UserMinus,
    UserPlus,
    Users,
} from "lucide-react";
import { toast } from "sonner";

import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
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
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
    useIndividualLearners,
    useCliniciansByRole,
    useUserProfiles,
    useAssignedClinicians,
    useAssignClinician,
    useUnassignClinician,
} from "@/hooks/use-assign-clinician";
import type {
    ClinicianRole,
    LearnerUser,
    ClinicianUser,
    UserProfile,
} from "@/services/assign-clinician.service";

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_DISPLAY: Record<ClinicianRole, string> = {
    trainee: "Clinical Learner",
    trainer: "Training Admin",
};

const MAX_CLINICIANS = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractErrorMessage(err: unknown, fallback: string): string {
    if (typeof err === "object" && err !== null && "response" in err) {
        const msg = (err as { response?: { data?: { message?: string } } })
            .response?.data?.message;
        if (msg) return msg;
    }
    return fallback;
}

// ── ProfilePicker ─────────────────────────────────────────────────────────────

function ProfilePicker({
    profiles,
    isLoading,
    selectedId,
    onSelect,
}: {
    profiles: UserProfile[];
    isLoading: boolean;
    selectedId: string | null;
    onSelect: (id: string) => void;
}) {
    if (isLoading) {
        return (
            <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-24 rounded-full" />
                ))}
            </div>
        );
    }
    if (profiles.length === 0) {
        return <p className="text-sm text-muted-foreground">No profiles found.</p>;
    }
    return (
        <div className="flex flex-wrap gap-2">
            {profiles.map((p) => (
                <button
                    key={p._id}
                    type="button"
                    onClick={() => onSelect(p._id)}
                    className={cn(
                        "px-3 py-1 rounded-full text-sm border transition-colors",
                        selectedId === p._id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border"
                    )}
                >
                    {p.name}
                    {p.isDefault && (
                        <span className="ml-1 text-xs opacity-70">(default)</span>
                    )}
                </button>
            ))}
        </div>
    );
}

function LearnerRow({
    user,
    isSelected,
    onRowClick,
    onOpenAssign,
    onOpenView,
}: {
    user: LearnerUser;
    isSelected: boolean;
    onRowClick: (id: string) => void;
    onOpenAssign: (user: LearnerUser) => void;
    onOpenView: (user: LearnerUser) => void;
}) {
    const accountLabel =
        user.accountType === "develop"
            ? "Develop"
            : user.accountType === "master"
            ? "Master"
            : "Free";

    return (
        <TableRow
            className={cn(
                "cursor-pointer hover:bg-muted/50 transition-colors",
                isSelected && "bg-muted/30"
            )}
            onClick={() => onRowClick(user.id)}
        >
            <TableCell className="w-[40%] py-3">
                <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-medium">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">{user.name}</span>
                        <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                    </div>
                </div>
            </TableCell>

            <TableCell className="w-[18%] py-3">
                <Badge variant="outline" className="capitalize">{accountLabel}</Badge>
            </TableCell>

            <TableCell className="w-[18%] py-3">
                <Badge variant={user.emailVerified ? "secondary" : "outline"}>
                    {user.emailVerified ? "Verified" : "Pending"}
                </Badge>
            </TableCell>

            <TableCell className="w-[14%] py-3 text-xs text-muted-foreground">
                {formatRelativeTime(user.createdAt)}
            </TableCell>

            <TableCell className="w-[10%] py-3 text-right">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="size-8">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="size-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); onOpenAssign(user); }}
                        >
                            <UserPlus className="size-4 mr-2" />
                            Assign Clinician
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); onOpenView(user); }}
                        >
                            <Stethoscope className="size-4 mr-2" />
                            View Assignments
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssignTraineePage() {
    // Table state
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [sortBy, setSortBy] = useState("name");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    // Shared dialog state
    const [actingUser, setActingUser] = useState<LearnerUser | null>(null);

    // Assign dialog state
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [assignProfileId, setAssignProfileId] = useState<string | null>(null);
    const [pickedRole, setPickedRole] = useState<ClinicianRole>("trainee");
    const [pickedClinicianId, setPickedClinicianId] = useState("");

    // View dialog state
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [viewProfileId, setViewProfileId] = useState<string | null>(null);

    // Unassign tracking
    const [unassigningKey, setUnassigningKey] = useState<string | null>(null);

    // ── Data ──────────────────────────────────────────────────────────────────

    const { data: learnersData, isLoading: isLearnersLoading } = useIndividualLearners({
        page, limit, search, sortBy, sortDirection,
    });

    const { data: traineesData = [] } = useCliniciansByRole("trainee");
    const { data: trainersData = [] } = useCliniciansByRole("trainer");

    // Profiles — fetched once per acting user, shared between both dialogs
    const { data: profiles = [], isLoading: isProfilesLoading } = useUserProfiles(
        actingUser?.id ?? null
    );

    // Assigned clinicians — keyed by (userId, profileId) so each profile caches separately
    const { data: assignedData, isLoading: isAssignedLoading } = useAssignedClinicians(
        actingUser?.id ?? null,
        assignProfileId ?? "",
        isAssignOpen
    );

    const { data: viewAssignedData, isLoading: isViewAssignedLoading } = useAssignedClinicians(
        actingUser?.id ?? null,
        viewProfileId ?? "",
        isViewOpen
    );

    const assignMutation   = useAssignClinician();
    const unassignMutation = useUnassignClinician();

    const learners = learnersData?.users ?? [];
    const meta     = learnersData?.meta;

    const clinicianPool: ClinicianUser[] =
        pickedRole === "trainer" ? trainersData : traineesData;

    // ── Auto-select default profile when dialog opens ─────────────────────────

    useEffect(() => {
        if (!isAssignOpen || profiles.length === 0 || assignProfileId !== null) return;
        const def = profiles.find((p) => p.isDefault) ?? profiles[0];
        setAssignProfileId(def._id);
    }, [isAssignOpen, profiles, assignProfileId]);

    useEffect(() => {
        if (!isViewOpen || profiles.length === 0 || viewProfileId !== null) return;
        const def = profiles.find((p) => p.isDefault) ?? profiles[0];
        setViewProfileId(def._id);
    }, [isViewOpen, profiles, viewProfileId]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleSort = (field: string) => {
        if (sortBy === field) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        else { setSortBy(field); setSortDirection("asc"); }
    };

    const openAssignDialog = (user: LearnerUser) => {
        setActingUser(user);
        setAssignProfileId(null);   // reset — useEffect will auto-select default
        setPickedRole("trainee");
        setPickedClinicianId("");
        setIsAssignOpen(true);
    };

    const openViewDialog = (user: LearnerUser) => {
        setActingUser(user);
        setViewProfileId(null);     // reset — useEffect will auto-select default
        setIsViewOpen(true);
    };

    const handleAssignSubmit = () => {
        if (!actingUser || !pickedClinicianId) return;
        const clinician = clinicianPool.find((c) => c.id === pickedClinicianId);
        if (!clinician) return;

        assignMutation.mutate(
            {
                userId: actingUser.id,
                profileId: assignProfileId ?? "",
                clinicianId: clinician.id,
                clinicianRole: pickedRole,
                clinicianEmail: clinician.email,
                clinicianName: clinician.name,
            },
            {
                onSuccess: () => {
                    const profileName =
                        profiles.find((p) => p._id === assignProfileId)?.name ?? "profile";
                    toast.success(
                        `${ROLE_DISPLAY[pickedRole]} assigned to ${actingUser.name} (${profileName})`
                    );
                    setPickedClinicianId("");
                },
                onError: (err) =>
                    toast.error(extractErrorMessage(err, "Failed to assign clinician")),
            }
        );
    };

    const handleUnassign = (clinicianId: string, clinicianRole: ClinicianRole) => {
        if (!actingUser) return;
        const key = `${clinicianRole}:${clinicianId}`;
        setUnassigningKey(key);

        unassignMutation.mutate(
            {
                userId: actingUser.id,
                profileId: viewProfileId ?? "",
                clinicianId,
                clinicianRole,
            },
            {
                onSuccess: () => toast.success("Clinician removed"),
                onError: (err) =>
                    toast.error(extractErrorMessage(err, "Failed to remove clinician")),
                onSettled: () => setUnassigningKey(null),
            }
        );
    };

    const assignedCount = assignedData?.clinicians?.length ?? 0;
    const atCapacity =
        assignedCount >= MAX_CLINICIANS &&
        !assignedData?.clinicians?.some(
            (c) => c.clinicianId === pickedClinicianId && c.clinicianRole === pickedRole
        );

    const viewAssignedCount = viewAssignedData?.clinicians?.length ?? 0;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col gap-6 p-8 h-full">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Clinician Assignments</h1>
                <p className="text-muted-foreground mt-1">
                    Assign Training Admins and Clinical Learners to Individual Learner profiles
                    with Clinical Assignment.
                </p>
            </div>

            {/* Search */}
            <div className="flex items-center justify-between">
                <div className="relative w-72">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                        placeholder="Search individual learners..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-background overflow-hidden">
                <div className="max-h-[500px] overflow-auto relative w-full">
                    <table className="w-full caption-bottom text-sm border-collapse table-fixed">
                        <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                            <TableRow className="hover:bg-transparent">
                                <TableHead
                                    className="w-[40%] bg-background py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => handleSort("name")}
                                >
                                    <div className="flex items-center gap-1">
                                        Individual Learner
                                        <ArrowUpDown className="size-3 text-muted-foreground" />
                                    </div>
                                </TableHead>
                                <TableHead className="w-[18%] bg-background py-3">Plan</TableHead>
                                <TableHead className="w-[18%] bg-background py-3">Email</TableHead>
                                <TableHead className="w-[14%] bg-background py-3">Joined</TableHead>
                                <TableHead className="w-[10%] bg-background py-3" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLearnersLoading ? (
                                Array.from({ length: 8 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={5} className="p-2">
                                            <Skeleton className="h-12 w-full" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : learners.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5}>
                                        <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
                                            <Users className="size-10 opacity-20" />
                                            <p>
                                                {search
                                                    ? `No learners found matching "${search}"`
                                                    : "No individual learners found"}
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                learners.map((user) => (
                                    <LearnerRow
                                        key={user.id}
                                        user={user}
                                        isSelected={selectedUserId === user.id}
                                        onRowClick={(id) =>
                                            setSelectedUserId((prev) => (prev === id ? null : id))
                                        }
                                        onOpenAssign={openAssignDialog}
                                        onOpenView={openViewDialog}
                                    />
                                ))
                            )}
                        </TableBody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {isLearnersLoading
                        ? "Loading..."
                        : meta && meta.total > 0
                        ? `Showing ${Math.min((meta.page - 1) * meta.limit + 1, meta.total)}–${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total} learners`
                        : "No learners"}
                </p>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 mr-2">
                        <span className="text-sm text-muted-foreground">Rows</span>
                        <Select
                            value={limit.toString()}
                            onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {["10", "20", "50", "100"].map((v) => (
                                    <SelectItem key={v} value={v}>{v}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        variant="outline" size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={!meta?.hasPrev || isLearnersLoading}
                    >
                        <ChevronLeft className="size-4" />
                        Previous
                    </Button>
                    <span className="text-sm font-medium">
                        Page {meta?.page ?? 1} of {meta?.totalPages ?? 1}
                    </span>
                    <Button
                        variant="outline" size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={!meta?.hasNext || isLearnersLoading}
                    >
                        Next
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            </div>

            {/* ── Assign Dialog ──────────────────────────────────────────────────── */}
            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                {/* fixed height so the dialog never grows off-screen */}
                <DialogContent className="sm:max-w-[560px] flex flex-col max-h-[90vh] overflow-hidden p-0 gap-0">
                    {/* Pinned header */}
                    <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                        <DialogTitle>Assign Clinician</DialogTitle>
                        <DialogDescription>
                            Choose a profile, then assign a clinician with Clinical Assignment.
                        </DialogDescription>
                    </DialogHeader>

                    {actingUser && (
                        <ScrollArea className="max-h-[calc(90vh-180px)] overflow-y-auto">
                            <div className="flex flex-col gap-5 px-6 py-5">

                                {/* Learner info */}
                                <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-3">
                                    <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <Stethoscope className="size-4 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium truncate">{actingUser.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{actingUser.email}</p>
                                    </div>
                                </div>

                                {/* Profile picker */}
                                <div className="flex flex-col gap-2">
                                    <Label>Profile</Label>
                                    <ProfilePicker
                                        profiles={profiles}
                                        isLoading={isProfilesLoading}
                                        selectedId={assignProfileId}
                                        onSelect={(id) => {
                                            setAssignProfileId(id);
                                            setPickedClinicianId("");
                                        }}
                                    />
                                </div>

                                <Separator />

                                {/* Role + clinician pickers */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="clinician-role">Role</Label>
                                        <Select
                                            value={pickedRole}
                                            onValueChange={(v) => {
                                                setPickedRole(v as ClinicianRole);
                                                setPickedClinicianId("");
                                            }}
                                            disabled={!assignProfileId}
                                        >
                                            <SelectTrigger id="clinician-role">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="trainee">Clinical Learner</SelectItem>
                                                <SelectItem value="trainer">Training Admin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="clinician-pick">Clinician</Label>
                                        <Select
                                            value={pickedClinicianId}
                                            onValueChange={setPickedClinicianId}
                                            disabled={!assignProfileId || clinicianPool.length === 0}
                                        >
                                            <SelectTrigger id="clinician-pick">
                                                <SelectValue
                                                    placeholder={
                                                        !assignProfileId
                                                            ? "Pick profile first…"
                                                            : clinicianPool.length === 0
                                                            ? "None available"
                                                            : "Select…"
                                                    }
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {clinicianPool.map((c) => (
                                                    <SelectItem key={c.id} value={c.id}>
                                                        <div className="flex flex-col text-left">
                                                            <span>{c.name}</span>
                                                            <span className="text-xs text-muted-foreground">{c.email}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Currently assigned on this profile */}
                                {assignProfileId && (
                                    <>
                                        <Separator />
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-muted-foreground">
                                                    Already on this profile
                                                </Label>
                                                {isAssignedLoading ? (
                                                    <Skeleton className="h-5 w-10" />
                                                ) : (
                                                    <Badge
                                                        variant={assignedCount >= MAX_CLINICIANS ? "destructive" : "secondary"}
                                                    >
                                                        {assignedCount} / {MAX_CLINICIANS}
                                                    </Badge>
                                                )}
                                            </div>

                                            {isAssignedLoading ? (
                                                <div className="flex flex-col gap-2">
                                                    {Array.from({ length: 2 }).map((_, i) => (
                                                        <Skeleton key={i} className="h-12 w-full" />
                                                    ))}
                                                </div>
                                            ) : assignedCount === 0 ? (
                                                <p className="text-sm text-muted-foreground italic py-1">
                                                    No clinicians assigned to this profile yet.
                                                </p>
                                            ) : (
                                                <div className="flex flex-col gap-1.5">
                                                    {assignedData!.clinicians.map((c) => (
                                                        <div
                                                            key={`${c.clinicianRole}:${c.clinicianId}`}
                                                            className="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-2"
                                                        >
                                                            <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-medium">
                                                                {c.clinicianName.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium truncate">{c.clinicianName}</p>
                                                                <p className="text-xs text-muted-foreground truncate">{c.clinicianEmail}</p>
                                                            </div>
                                                            <Badge variant="outline" className="shrink-0 text-xs">
                                                                {ROLE_DISPLAY[c.clinicianRole]}
                                                            </Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {assignedCount >= MAX_CLINICIANS && (
                                                <p className="text-xs text-destructive mt-1">
                                                    This profile has reached the {MAX_CLINICIANS}-clinician limit. Remove one to add another.
                                                </p>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </ScrollArea>
                    )}

                    {/* Pinned footer */}
                    <DialogFooter className="px-6 py-4 border-t shrink-0">
                        <Button
                            variant="outline"
                            onClick={() => setIsAssignOpen(false)}
                            disabled={assignMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAssignSubmit}
                            disabled={
                                !assignProfileId ||
                                !pickedClinicianId ||
                                assignMutation.isPending ||
                                atCapacity
                            }
                        >
                            {assignMutation.isPending ? (
                                <Loader2 className="size-4 mr-2 animate-spin" />
                            ) : (
                                <UserPlus className="size-4 mr-2" />
                            )}
                            {atCapacity ? "Capacity Reached" : "Confirm Assignment"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── View / Manage Dialog ───────────────────────────────────────────── */}
            <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                <DialogContent className="sm:max-w-[560px] flex flex-col max-h-[90vh] overflow-hidden p-0 gap-0">
                    {/* Pinned header */}
                    <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                        <DialogTitle>Assignment Details</DialogTitle>
                        <DialogDescription>
                            Switch profiles to view and manage each profile's clinicians independently.
                        </DialogDescription>
                    </DialogHeader>

                    {actingUser && (
                        <ScrollArea className="max-h-[calc(90vh-120px)] overflow-y-auto">
                            <div className="flex flex-col gap-5 px-6 py-5">

                                {/* Learner card */}
                                <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-3">
                                    <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <Stethoscope className="size-4 text-primary" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium truncate">{actingUser.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{actingUser.email}</p>
                                    </div>
                                    {actingUser.createdAt && (
                                        <p className="text-xs text-muted-foreground shrink-0">
                                            {formatRelativeTime(actingUser.createdAt)}
                                        </p>
                                    )}
                                </div>

                                {/* Profile picker */}
                                <div className="flex flex-col gap-2">
                                    <Label>Profile</Label>
                                    <ProfilePicker
                                        profiles={profiles}
                                        isLoading={isProfilesLoading}
                                        selectedId={viewProfileId}
                                        onSelect={setViewProfileId}
                                    />
                                </div>

                                <Separator />

                                {/* Per-profile clinician count header */}
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Clinicians on this profile</span>
                                    {isViewAssignedLoading ? (
                                        <Skeleton className="h-5 w-10" />
                                    ) : (
                                        <Badge variant={viewAssignedCount >= MAX_CLINICIANS ? "destructive" : "secondary"}>
                                            {viewAssignedCount} / {MAX_CLINICIANS}
                                        </Badge>
                                    )}
                                </div>

                                {/* Clinicians list */}
                                {isViewAssignedLoading ? (
                                    <div className="flex flex-col gap-2">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <Skeleton key={i} className="h-14 w-full" />
                                        ))}
                                    </div>
                                ) : !viewProfileId ? (
                                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                                        <Stethoscope className="size-8 opacity-20" />
                                        <p className="text-sm">Select a profile above to view its clinicians.</p>
                                    </div>
                                ) : viewAssignedCount === 0 ? (
                                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                                        <Stethoscope className="size-8 opacity-20" />
                                        <p className="text-sm">No clinicians on this profile yet.</p>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setIsViewOpen(false);
                                                openAssignDialog(actingUser);
                                            }}
                                        >
                                            <UserPlus className="size-3.5 mr-1.5" />
                                            Assign now
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {viewAssignedData!.clinicians.map((c) => {
                                            const key = `${c.clinicianRole}:${c.clinicianId}`;
                                            const isRemoving =
                                                unassignMutation.isPending && unassigningKey === key;
                                            return (
                                                <div
                                                    key={key}
                                                    className="flex items-center gap-3 rounded-md border px-3 py-2.5"
                                                >
                                                    <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-medium">
                                                        {c.clinicianName.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{c.clinicianName}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{c.clinicianEmail}</p>
                                                    </div>
                                                    <Badge variant="outline" className="shrink-0 text-xs">
                                                        {ROLE_DISPLAY[c.clinicianRole]}
                                                    </Badge>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleUnassign(c.clinicianId, c.clinicianRole)}
                                                        disabled={unassignMutation.isPending}
                                                        title="Remove clinician"
                                                    >
                                                        {isRemoving ? (
                                                            <Loader2 className="size-4 animate-spin" />
                                                        ) : (
                                                            <UserMinus className="size-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Quick assign CTA — only shown when there's room */}
                                {viewProfileId && viewAssignedCount > 0 && viewAssignedCount < MAX_CLINICIANS && (
                                    <>
                                        <Separator />
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setIsViewOpen(false);
                                                openAssignDialog(actingUser);
                                            }}
                                        >
                                            <UserPlus className="size-4 mr-2" />
                                            Assign Another Clinician
                                        </Button>
                                    </>
                                )}
                            </div>
                        </ScrollArea>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
