import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Search,
  User as UserIcon,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { apiClient } from "@/lib/api";
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

// Domain models
type ClinicianRole = "trainee" | "trainer";

type Clinician = {
  clinicianId: string;
  clinicianRole: ClinicianRole;
  clinicianEmail: string;
  clinicianName: string;
};

const ROLE_DISPLAY: Record<ClinicianRole, string> = {
  trainee: "Clinical Learner",
  trainer: "Training Admin",
};

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  traineeId?: string | null;
  traineeName?: string | null;
  traineeEmail?: string | null;
  clinicians?: Clinician[];
  createdAt: string;
  updatedAt: string;
}

interface AssignClinicianPayload {
  userId: string;
  clinicianId: string;
  clinicianRole: ClinicianRole;
  clinicianEmail: string;
  clinicianName: string;
}

/** Fetches paginated individual learners (role: user) with search/sort controls */
const fetchUsers = async ({ 
  page = 1, 
  limit = 10, 
  search = "", 
  sortBy = "createdAt", 
  sortDirection = "asc" 
}) => {
  const params: Record<string, string | number> = {
    page,
    limit,
    sortBy,
    sortDirection,
    role: "user",
    field: "name",
  };
  if (search) {
    params.search = search;
  }
  const response = await apiClient.get("/admin/list-user/all", { params });
  return response.data.data;
};

const fetchCliniciansByRole = async (role: ClinicianRole) => {
  const response = await apiClient.get("/admin/list-user/all", {
    params: { page: 1, limit: 1000, role },
  });

  const users = (response.data?.data?.users || []) as User[];
  return users.filter((u) => u.role === role);
};

const fetchAssignedCliniciansForUser = async (userId: string) => {
  const response = await apiClient.get(`/assign-clinical/${userId}`);
  const data = response.data?.data as
    | { userId: string; clinicians: Clinician[] }
    | undefined;
  return {
    userId: data?.userId ?? userId,
    clinicians: data?.clinicians ?? [],
  };
};

const assignClinician = async (payload: AssignClinicianPayload) => {
  const response = await apiClient.post("/assign-clinical/assign", payload);
  return response.data;
};

const unassignClinician = async (payload: { userId: string; clinicianId: string; clinicianRole: ClinicianRole }) => {
  const response = await apiClient.delete("/assign-clinical/assign", {
    data: payload,
  });
  return response.data;
};

function UserRow({
  user,
  isSelected,
  onRowClick,
  onOpenAssign,
  onOpenView,
}: {
  user: User;
  isSelected: boolean;
  onRowClick: (userId: string) => void;
  onOpenAssign: (user: User) => void;
  onOpenView: (user: User) => void;
}) {
  const { data: assignedData, isLoading: isAssignedLoading } = useQuery({
    queryKey: ["assigned-clinicians", user.id, "row"],
    queryFn: () => fetchAssignedCliniciansForUser(user.id),
    staleTime: 60 * 1000,
  });

  const clinicianCount = assignedData?.clinicians?.length ?? 0;
  const isAssigned = clinicianCount > 0;
  const fallbackClinicianName = assignedData?.clinicians?.[0]?.clinicianName ?? "";

  return (
    <TableRow
      key={user.id}
      className={`w-full cursor-pointer hover:bg-muted/50 ${isSelected ? "bg-muted/50" : ""}`}
      onClick={() => onRowClick(user.id)}
    >
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
      <TableCell className="w-[15%] py-2">
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
      <TableCell className="w-[25%] py-2">
        <div className="flex flex-col truncate">
          {isAssignedLoading ? (
            <span className="text-muted-foreground">Loading...</span>
          ) : isAssigned ? (
            <span className="font-medium truncate" title={fallbackClinicianName}>
              {clinicianCount === 1 ? fallbackClinicianName : `${clinicianCount} clinicians`}
            </span>
          ) : (
            <span className="text-muted-foreground italic">Not Assigned</span>
          )}
        </div>
      </TableCell>
      <TableCell className="w-[20%] py-2">
        {isAssignedLoading ? (
          <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted shadow-none">
            Loading
          </Badge>
        ) : isAssigned ? (
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 shadow-none border-transparent"
          >
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Assigned
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted shadow-none">
            Unassigned
          </Badge>
        )}
      </TableCell>
      <TableCell className="w-[15%] py-2 text-right">
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAssign(user);
                }}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Assign Clinician
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenView(user);
                }}
              >
                <UserIcon className="mr-2 h-4 w-4" />
                View Clinicians
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

/** Management interface for assigning clinical trainees to individual learners */
export default function AssignTraineePage() {
  const queryClient = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [actingUser, setActingUser] = useState<User | null>(null);
  const [selectedClinicianRole, setSelectedClinicianRole] = useState<ClinicianRole>("trainee");
  const [selectedClinicianId, setSelectedClinicianId] = useState<string>("");
  const [unassigningKey, setUnassigningKey] = useState<string | null>(null);

  const { data: usersData, isLoading: isUsersLoading } = useQuery({
    queryKey: ["users-assignment", page, limit, search, sortBy, sortDirection],
    queryFn: () => fetchUsers({ page, limit, search, sortBy, sortDirection }),
  });

  const { data: traineesData } = useQuery({
    queryKey: ["clinicians-list", "trainee"],
    queryFn: () => fetchCliniciansByRole("trainee"),
    staleTime: 5 * 60 * 1000,
  });

  const { data: trainersData } = useQuery({
    queryKey: ["clinicians-list", "trainer"],
    queryFn: () => fetchCliniciansByRole("trainer"),
    staleTime: 5 * 60 * 1000,
  });

  const { data: assignedCliniciansData, isLoading: isAssignedCliniciansLoading } = useQuery({
    queryKey: ["assigned-clinicians", actingUser?.id],
    queryFn: () => fetchAssignedCliniciansForUser(actingUser!.id),
    enabled: !!actingUser && (isAssignDialogOpen || isViewDialogOpen),
    staleTime: 60 * 1000,
  });

  const users = useMemo(() => usersData?.users || [], [usersData]);
  const meta = usersData?.meta;

  const assignMutation = useMutation({
    mutationFn: assignClinician,
    onSuccess: () => {
      toast.success("Clinician assignment updated");
      queryClient.invalidateQueries({ queryKey: ["users-assignment"] });
      queryClient.invalidateQueries({ queryKey: ["assigned-clinicians"] });
      setSelectedClinicianId("");
    },
    onError: (err: unknown) => {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data?.message
          ? (err as { response?: { data?: { message?: string } } }).response!.data!.message!
          : "Failed to assign clinician";
      toast.error(message);
    },
  });

  const unassignMutation = useMutation({
    mutationFn: unassignClinician,
    onMutate: (variables) => {
      setUnassigningKey(`${variables.clinicianRole}:${variables.clinicianId}`);
    },
    onSuccess: () => {
      toast.success("Clinician unassigned");
      queryClient.invalidateQueries({ queryKey: ["users-assignment"] });
      queryClient.invalidateQueries({ queryKey: ["assigned-clinicians"] });
      setSelectedClinicianId("");
    },
    onSettled: () => {
      setUnassigningKey(null);
    },
    onError: (err: unknown) => {
      const message =
        typeof err === "object" &&
        err !== null &&
        "response" in err &&
        (err as { response?: { data?: { message?: string } } }).response?.data?.message
          ? (err as { response?: { data?: { message?: string } } }).response!.data!.message!
          : "Failed to unassign clinician";
      toast.error(message);
    },
  });


  // Sorting toggle on column headers
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDirection("asc");
    }
  };

  // Selection toggle for table rows
  const handleRowClick = (userId: string) => {
    if (selectedUserId === userId) {
      setSelectedUserId(null);
    } else {
      setSelectedUserId(userId);
    }
  };

  const openAssignDialog = (user: User) => {
    setActingUser(user);
    setSelectedClinicianRole("trainee");
    setSelectedClinicianId("");
    setIsAssignDialogOpen(true);
  };

  const openViewDialog = (user: User) => {
    setActingUser(user);
    setIsViewDialogOpen(true);
  };

  const handleAssignSubmit = () => {
    if (!actingUser || !selectedClinicianId) return;

    const source = selectedClinicianRole === "trainer" ? trainersData : traineesData;
    const clinician = source?.find((c: User) => c.id === selectedClinicianId);
    if (!clinician) return;

    assignMutation.mutate({
      userId: actingUser.id,
      clinicianId: clinician.id,
      clinicianRole: selectedClinicianRole,
      clinicianEmail: clinician.email,
      clinicianName: clinician.name,
    });
  };

  // No virtualization: render list directly with standard map

  return (
    <div className="space-y-6 p-8 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Individual Learner – Clinician Assignments</h1>
        <p className="text-muted-foreground mt-1">
          Manage Clinical Learner and Training Admin assignments for Individual Learners.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search individual learners..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-md border bg-background overflow-hidden">
        <div
          ref={parentRef}
          className="max-h-[500px] overflow-auto relative w-full"
        >
          <table className="w-full caption-bottom text-sm border-collapse table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
              <TableRow className="hover:bg-transparent">
                <TableHead 
                  className="w-[25%] bg-background py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-1">
                    Individual Learner
                    {sortBy === "name" && <ArrowUpDown className="h-3 w-3" />}
                  </div>
                </TableHead>
                <TableHead className="w-[15%] bg-background py-2">Email Verified</TableHead>
                <TableHead className="w-[25%] bg-background py-2">Assigned Clinicians</TableHead>
                <TableHead className="w-[20%] bg-background py-2">Status</TableHead>
                <TableHead className="w-[15%] bg-background py-2 text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isUsersLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5} className="p-2">
                      <Skeleton className="h-12 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="flex h-40 items-center justify-center text-muted-foreground flex-col">
                      <Users className="h-10 w-10 mb-2 opacity-20" />
                      <p>{search ? `No users found matching "${search}"` : "No users found"}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user: User) => {
                  const isSelected = selectedUserId === user.id;
                  return (
                    <UserRow
                      key={user.id}
                      user={user}
                      isSelected={isSelected}
                      onRowClick={handleRowClick}
                      onOpenAssign={openAssignDialog}
                      onOpenView={openViewDialog}
                    />
                  );
                })
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Assign Clinician
            </DialogTitle>
            <DialogDescription>
              Select a clinician to assign to this Individual Learner.
            </DialogDescription>
          </DialogHeader>
          
          {actingUser && (
            <div className="space-y-6 py-4">
              <div className="rounded-lg border p-4 bg-muted/20">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Selected User</Label>
                <div className="mt-1 font-medium">{actingUser.name}</div>
                <div className="text-sm text-muted-foreground">{actingUser.email}</div>
              </div>

              <div className="space-y-3">
                <Label>Select Clinician Role</Label>
                <Select
                  value={selectedClinicianRole}
                  onValueChange={(v) => {
                    setSelectedClinicianRole(v as ClinicianRole);
                    setSelectedClinicianId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trainee">Clinical Learner</SelectItem>
                    <SelectItem value="trainer">Training Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>
                  Select Clinician{" "}
                  <span className="text-xs text-muted-foreground">
                    ({assignedCliniciansData?.clinicians?.length || 0}/5 assigned)
                  </span>
                </Label>
                <Select value={selectedClinicianId} onValueChange={setSelectedClinicianId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a clinician..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedClinicianRole === "trainer" ? trainersData : traineesData)?.map((clinician: User) => (
                      <SelectItem key={clinician.id} value={clinician.id}>
                        <div className="flex flex-col text-left">
                          <span>{clinician.name}</span>
                          <span className="text-xs text-muted-foreground">{clinician.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Currently Assigned</Label>
                {isAssignedCliniciansLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : (assignedCliniciansData?.clinicians?.length || 0) === 0 ? (
                  <div className="text-sm text-muted-foreground italic">No clinicians assigned</div>
                ) : (
                  <div className="space-y-2">
                    {assignedCliniciansData!.clinicians.map((c) => (
                      <div key={`${c.clinicianRole}:${c.clinicianId}`} className="flex items-center justify-between rounded-md border p-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.clinicianName}</div>
                          <div className="text-xs text-muted-foreground truncate">{c.clinicianEmail}</div>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {ROLE_DISPLAY[c.clinicianRole]}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAssignDialogOpen(false)}
              disabled={assignMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAssignSubmit}
              disabled={
                !selectedClinicianId ||
                assignMutation.isPending ||
                ((assignedCliniciansData?.clinicians?.length || 0) >= 5 &&
                  !assignedCliniciansData?.clinicians?.some(
                    (c) =>
                      c.clinicianId === selectedClinicianId &&
                      c.clinicianRole === selectedClinicianRole
                  ))
              }
            >
              {assignMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assignment Details</DialogTitle>
          </DialogHeader>
          {actingUser && (
            <div className="space-y-6">
              <div className="space-y-1">
                <Label className="text-muted-foreground">Individual Learner</Label>
                <div className="text-lg font-medium">{actingUser.name}</div>
                <div className="text-sm text-muted-foreground">{actingUser.email}</div>
              </div>
              
              <div className="border-t my-4" />

              <div className="space-y-2">
                <Label className="text-muted-foreground">
                  Assigned Clinicians{" "}
                  <span className="text-xs text-muted-foreground">
                    ({assignedCliniciansData?.clinicians?.length || 0}/5)
                  </span>
                </Label>
                {isAssignedCliniciansLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : (assignedCliniciansData?.clinicians?.length || 0) === 0 ? (
                  <div className="text-sm text-muted-foreground italic">No clinicians assigned</div>
                ) : (
                  <div className="space-y-2">
                    {assignedCliniciansData!.clinicians.map((c) => {
                      const key = `${c.clinicianRole}:${c.clinicianId}`;
                      const isUnassigning = unassignMutation.isPending && unassigningKey === key;
                      return (
                      <div key={key} className="flex items-center justify-between gap-3 rounded-md border p-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.clinicianName}</div>
                          <div className="text-xs text-muted-foreground truncate">{c.clinicianEmail}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {ROLE_DISPLAY[c.clinicianRole]}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() =>
                              unassignMutation.mutate({
                                userId: actingUser.id,
                                clinicianId: c.clinicianId,
                                clinicianRole: c.clinicianRole,
                              })
                            }
                            disabled={unassignMutation.isPending}
                          >
                            {isUnassigning ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserX className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

