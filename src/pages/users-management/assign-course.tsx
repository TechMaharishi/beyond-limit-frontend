import { useState, useMemo, useEffect } from "react";
import {
    ArrowUpDown,
    BookOpen,
    ChevronLeft,
    ChevronRight,
    GraduationCap,
    Loader2,
    MoreHorizontal,
    Search,
    Trash2,
    Users,
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
    Tabs,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";

import {
    useAssignableUsers,
    usePublishedCourses,
    useUserAssignedCourses,
    useAssignCoursesBulk,
    useUnassignCourse,
    useUserProfilesForCourseAssignment,
} from "@/hooks/use-assign-course";
import type { AssignableUser, UserProfile } from "@/services/assign-course.service";

const ROLE_LABELS: Record<string, string> = {
    admin: "Super Admin",
    trainer: "Training Admin",
    trainee: "Clinical Learner",
    user: "Individual Learner",
};

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

// ─── ProfilePicker ────────────────────────────────────────────────────────────

interface ProfilePickerProps {
    profiles: UserProfile[];
    isLoading: boolean;
    selectedProfileId: string | null;
    onSelect: (id: string) => void;
}

function ProfilePicker({ profiles, isLoading, selectedProfileId, onSelect }: ProfilePickerProps) {
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
        return <p className="text-sm text-muted-foreground">No profiles found for this user.</p>;
    }
    return (
        <div className="flex flex-wrap gap-2">
            {profiles.map((p) => (
                <button
                    key={p._id}
                    type="button"
                    onClick={() => onSelect(p._id)}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        selectedProfileId === p._id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border"
                    }`}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssignCoursePage() {
    const { data: session } = authClient.useSession();
    const currentUserRole = session?.user?.role || "user";
    const currentUserId = session?.user?.id || "";
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
    const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
    const [courseSearch, setCourseSearch] = useState("");
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

    const isUserTab = activeTab === "user";
    const requiresProfile = isUserTab;
    const profileReady = !requiresProfile || !!selectedProfileId;

    const { data: usersData, isLoading: isUsersLoading } = useAssignableUsers(
        activeTab,
        { page, limit, search, sortBy, sortDirection }
    );

    const [coursesPage, setCoursesPage] = useState(1);
    const [coursesLimit, setCoursesLimit] = useState(10);
    const { data: coursesData, isLoading: isCoursesLoading } = usePublishedCourses({
        page: coursesPage,
        limit: coursesLimit,
        sortBy: "createdAt",
        order: "desc",
    });

    const selectedUserId = selectedUser?.id || null;
    const isSelectedUserRole = selectedUser?.role === "user";

    const { data: userProfiles = [], isLoading: isProfilesLoading } =
        useUserProfilesForCourseAssignment(isSelectedUserRole ? selectedUserId : null);

    const [assignedPage, setAssignedPage] = useState(1);
    const [assignedLimit, setAssignedLimit] = useState(10);
    const { data: assignedCoursesData, isLoading: isAssignedLoading } = useUserAssignedCourses(
        selectedUserId,
        {
            page: assignedPage,
            limit: assignedLimit,
            ...(isSelectedUserRole && selectedProfileId ? { profileId: selectedProfileId } : {}),
        }
    );

    const assignBulkMutation = useAssignCoursesBulk();
    const unassignMutation = useUnassignCourse();

    const users = useMemo(() => usersData?.users || [], [usersData]);
    const meta = usersData?.meta;
    const courses = useMemo(() => coursesData?.courses || [], [coursesData]);
    const coursesMeta = coursesData?.meta;
    const assignedCourses = useMemo(() => assignedCoursesData?.courses || [], [assignedCoursesData]);
    const assignedMeta = assignedCoursesData?.meta;

    const assignedCourseIds = useMemo(
        () => new Set(assignedCourses.map((ac) => ac.course._id)),
        [assignedCourses]
    );

    const filteredCourses = useMemo(
        () => courses.filter((course) =>
            course.title.toLowerCase().includes(courseSearch.toLowerCase())
        ),
        [courses, courseSearch]
    );

    // Auto-select default profile
    useEffect(() => {
        if (userProfiles.length > 0 && !selectedProfileId) {
            const def = userProfiles.find((p) => p.isDefault) ?? userProfiles[0];
            setSelectedProfileId(def._id);
        }
    }, [userProfiles]);

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortBy(field);
            setSortDirection("asc");
        }
    };

    const handleTabChange = (value: string) => {
        setActiveTab(value as "trainee" | "user");
        setPage(1);
        setSearch("");
    };

    const openAssignDialog = (user: AssignableUser) => {
        setSelectedUser(user);
        setSelectedCourseIds([]);
        setCourseSearch("");
        setSelectedProfileId(null);
        setIsAssignDialogOpen(true);
    };

    const openViewDialog = (user: AssignableUser) => {
        setSelectedUser(user);
        setSelectedProfileId(null);
        setIsViewDialogOpen(true);
    };

    const handleCourseToggle = (courseId: string) => {
        if (assignedCourseIds.has(courseId)) return;
        setSelectedCourseIds((prev) =>
            prev.includes(courseId)
                ? prev.filter((id) => id !== courseId)
                : [...prev, courseId]
        );
    };

    const handleAssignSubmit = async () => {
        if (!selectedUser || selectedCourseIds.length === 0) return;

        try {
            await assignBulkMutation.mutateAsync(
                selectedCourseIds.map((courseId) => ({
                    userId: selectedUser.id,
                    courseId,
                    ...(selectedProfileId ? { profileId: selectedProfileId } : {}),
                }))
            );
            toast.success(`${selectedCourseIds.length} course(s) assigned successfully`);
            setIsAssignDialogOpen(false);
            setSelectedUser(null);
            setSelectedCourseIds([]);
        } catch (error: unknown) {
            const message =
                typeof error === "object" &&
                error !== null &&
                "response" in error &&
                (error as { response?: { data?: { message?: string } } }).response?.data?.message
                    ? (error as { response?: { data?: { message?: string } } }).response!.data!.message!
                    : "Failed to assign courses";
            toast.error(message);
        }
    };

    const handleUnassign = async (courseId: string) => {
        if (!selectedUser) return;

        try {
            await unassignMutation.mutateAsync({
                userId: selectedUser.id,
                courseId,
                ...(selectedProfileId ? { profileId: selectedProfileId } : {}),
            });
            toast.success("Course unassigned successfully");
        } catch (error: unknown) {
            const message =
                typeof error === "object" &&
                error !== null &&
                "response" in error &&
                (error as { response?: { data?: { message?: string } } }).response?.data?.message
                    ? (error as { response?: { data?: { message?: string } } }).response!.data!.message!
                    : "Failed to unassign course";
            toast.error(message);
        }
    };

    if (assignableRoles.length === 0) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h2 className="mt-4 text-lg font-semibold">Access Denied</h2>
                    <p className="text-muted-foreground">
                        You don't have permission to assign courses.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-8 h-full flex flex-col">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Assign Courses</h1>
                <p className="text-muted-foreground mt-1">
                    Assign courses to {assignableRoles.includes("trainee") ? "Clinical Learners and " : ""}
                    Individual Learners.
                </p>
            </div>

            {assignableRoles.length > 1 && (
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                    <TabsList>
                        <TabsTrigger value="trainee" className="gap-2">
                            <GraduationCap className="h-4 w-4" />
                            Clinical Learners
                        </TabsTrigger>
                        <TabsTrigger value="user" className="gap-2">
                            <Users className="h-4 w-4" />
                            Individual Learners
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            )}

            <div className="flex items-center justify-between">
                <div className="relative w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={`Search ${ROLE_LABELS[activeTab]}s...`}
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="pl-8"
                    />
                </div>
            </div>

            {/* Users Table */}
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
                                    <TableRow key={user.id} className="cursor-pointer hover:bg-muted/50">
                                        <TableCell className="w-[25%] py-2">
                                            <div className="flex flex-col truncate">
                                                <span className="font-medium truncate" title={user.name}>
                                                    {user.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground truncate" title={user.email}>
                                                    {user.email}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[15%] py-2 capitalize">
                                            {user.accountType || "-"}
                                        </TableCell>
                                        <TableCell className="w-[10%] py-2">
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
                                                        <BookOpen className="mr-2 h-4 w-4" />
                                                        Assign Course
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openViewDialog(user)}>
                                                        <GraduationCap className="mr-2 h-4 w-4" />
                                                        View Assigned Courses
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

            {/* Assign Course Dialog */}
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                <DialogContent className="sm:max-w-[900px] h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Assign Courses</DialogTitle>
                        <DialogDescription>
                            Select courses to assign to {selectedUser?.name}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedUser && (
                        <div className="flex-1 flex flex-col gap-4 overflow-hidden p-1">
                            {/* Profile Picker — Individual Learners only */}
                            {isSelectedUserRole && (
                                <div className="space-y-1">
                                    <Label>Profile</Label>
                                    <ProfilePicker
                                        profiles={userProfiles}
                                        isLoading={isProfilesLoading}
                                        selectedProfileId={selectedProfileId}
                                        onSelect={setSelectedProfileId}
                                    />
                                </div>
                            )}

                            {/* Course Search */}
                            <div className="space-y-2">
                                <Label>Search Courses</Label>
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search available courses..."
                                        value={courseSearch}
                                        onChange={(e) => setCourseSearch(e.target.value)}
                                        className="pl-8"
                                    />
                                </div>
                            </div>

                            {/* Course List */}
                            <div className="flex-1 flex flex-col min-h-0 gap-2">
                                <Label>
                                    Available Courses ({filteredCourses.length}
                                    {assignedCourseIds.size > 0 && ` · ${assignedCourseIds.size} assigned`})
                                    {selectedCourseIds.length > 0 && (
                                        <span className="ml-2 text-primary">
                                            • {selectedCourseIds.length} selected
                                        </span>
                                    )}
                                </Label>
                                <div className="flex-1 min-h-0 border rounded-md overflow-hidden relative">
                                    <div className="absolute inset-0 overflow-y-auto">
                                        {isCoursesLoading || isAssignedLoading ? (
                                            <div className="p-4 space-y-2">
                                                {Array.from({ length: 8 }).map((_, i) => (
                                                    <Skeleton key={i} className="h-12 w-full" />
                                                ))}
                                            </div>
                                        ) : filteredCourses.length === 0 ? (
                                            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                                                <div className="text-center">
                                                    <BookOpen className="mx-auto h-8 w-8 opacity-20" />
                                                    <p className="mt-2">
                                                        {courseSearch
                                                            ? "No courses found matching search"
                                                            : "No available courses to assign"}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-2 space-y-2">
                                                {filteredCourses.map((course) => {
                                                    const alreadyAssigned = assignedCourseIds.has(course._id);
                                                    return (
                                                        <div
                                                            key={course._id}
                                                            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                                                                alreadyAssigned
                                                                    ? "opacity-60 cursor-not-allowed bg-muted/30"
                                                                    : selectedCourseIds.includes(course._id)
                                                                    ? "bg-primary/5 border-primary cursor-pointer"
                                                                    : "hover:bg-muted/50 cursor-pointer"
                                                            }`}
                                                            onClick={() => handleCourseToggle(course._id)}
                                                        >
                                                            <Checkbox
                                                                checked={selectedCourseIds.includes(course._id)}
                                                                disabled={alreadyAssigned}
                                                                className="mt-1"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <h4 className="font-medium truncate" title={course.title}>
                                                                        {course.title.length > 20 ? course.title.slice(0, 20) + "..." : course.title}
                                                                    </h4>
                                                                    {alreadyAssigned && (
                                                                        <Badge className="text-xs shrink-0 bg-emerald-100 text-emerald-800 border-transparent shadow-none hover:bg-emerald-100">
                                                                            Assigned
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm text-muted-foreground line-clamp-2">
                                                                    {course.description.length > 50 ? course.description.slice(0, 50) + "..." : course.description}
                                                                </p>
                                                                <div className="mt-1 flex items-center gap-1 flex-wrap">
                                                                    <Badge variant="outline" className="text-xs capitalize">
                                                                        {course.accessLevel}
                                                                    </Badge>
                                                                    {course.tags.slice(0, 3).map((tag) => (
                                                                        <Badge key={tag} variant="outline" className="text-xs">
                                                                            {tag}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            {course.thumbnailUrl && (
                                                                <img
                                                                    src={course.thumbnailUrl}
                                                                    alt=""
                                                                    className="w-28 h-20 object-cover rounded"
                                                                />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-2">
                                    <div className="text-sm text-muted-foreground">
                                        {isCoursesLoading ? (
                                            "Loading..."
                                        ) : coursesMeta && coursesMeta.total > 0 ? (
                                            <>Showing {Math.min((coursesMeta.page - 1) * coursesMeta.limit + 1, coursesMeta.total)} to {Math.min(coursesMeta.page * coursesMeta.limit, coursesMeta.total)} of {coursesMeta.total} courses</>
                                        ) : (
                                            "Showing 0 to 0 of 0 courses"
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className="flex items-center space-x-2 mr-4">
                                            <span className="text-sm text-muted-foreground">Rows per page</span>
                                            <Select
                                                value={coursesLimit.toString()}
                                                onValueChange={(val) => {
                                                    setCoursesLimit(Number(val));
                                                    setCoursesPage(1);
                                                }}
                                            >
                                                <SelectTrigger className="h-8 w-[70px]">
                                                    <SelectValue placeholder={coursesLimit} />
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
                                            onClick={() => setCoursesPage((p) => Math.max(1, p - 1))}
                                            disabled={!coursesMeta?.hasPrev || isCoursesLoading}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Previous
                                        </Button>
                                        <div className="text-sm font-medium">
                                            Page {coursesMeta?.page || 1} of {coursesMeta?.totalPages || 1}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCoursesPage((p) => p + 1)}
                                            disabled={!coursesMeta?.hasNext || isCoursesLoading}
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
                            disabled={assignBulkMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAssignSubmit}
                            disabled={
                                selectedCourseIds.length === 0 ||
                                assignBulkMutation.isPending ||
                                !profileReady
                            }
                        >
                            {assignBulkMutation.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Assign {selectedCourseIds.length > 0 && `(${selectedCourseIds.length})`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Assigned Courses Dialog */}
            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className="sm:max-w-[900px] h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Assigned Courses</DialogTitle>
                        <DialogDescription>
                            Courses assigned to {selectedUser?.name}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedUser && (
                        <div className="flex-1 flex flex-col gap-4 overflow-hidden p-1">
                            {/* Profile Picker — Individual Learners only */}
                            {isSelectedUserRole && (
                                <div className="space-y-1">
                                    <Label>Profile</Label>
                                    <ProfilePicker
                                        profiles={userProfiles}
                                        isLoading={isProfilesLoading}
                                        selectedProfileId={selectedProfileId}
                                        onSelect={setSelectedProfileId}
                                    />
                                </div>
                            )}

                            {/* Assigned Courses List */}
                            <div className="flex-1 min-h-0 border rounded-md overflow-hidden relative">
                                <div className="absolute inset-0 overflow-y-auto">
                                    {isAssignedLoading ? (
                                        <div className="space-y-2 p-4">
                                            {Array.from({ length: 8 }).map((_, i) => (
                                                <Skeleton key={i} className="h-12 w-full" />
                                            ))}
                                        </div>
                                    ) : assignedCourses.length === 0 ? (
                                        <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                                            <div className="text-center">
                                                <BookOpen className="mx-auto h-8 w-8 opacity-20" />
                                                <p className="mt-2">No courses assigned yet</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 p-3">
                                            {assignedCourses.map((assignment) => (
                                                <div
                                                    key={assignment.course._id}
                                                    className="flex items-start gap-3 p-3 rounded-lg border"
                                                >
                                                    {assignment.course.thumbnailUrl && (
                                                        <img
                                                            src={assignment.course.thumbnailUrl}
                                                            alt=""
                                                            className="w-28 h-20 object-cover rounded"
                                                        />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium truncate">
                                                            {assignment.course.title}
                                                        </h4>
                                                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                                            <span>Assigned by {assignment.assignedBy.name}</span>
                                                            <span>•</span>
                                                            <span>{formatRelativeTime(assignment.assignedAt)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <Progress
                                                                value={assignment.progressSummary.percentCompleted}
                                                                className="h-2 flex-1"
                                                            />
                                                            <span className="text-xs text-muted-foreground w-10">
                                                                {assignment.progressSummary.percentCompleted}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {(currentUserRole === "admin" ||
                                                        assignment.assignedBy.id === currentUserId) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleUnassign(assignment.course._id)}
                                                            disabled={unassignMutation.isPending}
                                                        >
                                                            {unassignMutation.isPending ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                    )}
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
                                        <>Showing {Math.min((assignedMeta.page - 1) * assignedMeta.limit + 1, assignedMeta.total)} to {Math.min(assignedMeta.page * assignedMeta.limit, assignedMeta.total)} of {assignedMeta.total} courses</>
                                    ) : (
                                        "Showing 0 to 0 of 0 courses"
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
                                <BookOpen className="mr-2 h-4 w-4" />
                                Assign More Courses
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
