import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { getCountries, getCountryCallingCode, validatePhoneNumberLength, parsePhoneNumberFromString } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  Loader2, Trash2, Plus, MoreHorizontal, Copy, Edit, Shield, Ban, Lock, CheckCircle, 
  Search, ArrowUpDown, ChevronLeft, ChevronRight, Filter, 
  Users
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Domain models

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "trainer" | "trainee" | "user";
  accountType: string;
  emailVerified: boolean;
  banned: boolean;
  createdAt: string;
  phone?: string;
}

interface UsersResponse {
  data: {
    users: User[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

interface FetchUsersParams {
  role?: string;
  search?: string;
  field?: "name" | "email";
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
  limit?: number;
}

interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: "admin" | "trainer" | "trainee" | "user";
  accountType: string;
  phone: string;
  newsletter: boolean;
}

// API service functions

/** Fetches paginated users with optional role, search, sort, and limit */
const fetchUsers = async (params: FetchUsersParams) => {
  // Construct clean query params by excluding empty values
  const queryParams: Record<string, any> = {};
  if (params.role && params.role !== "all") queryParams.role = params.role;
  if (params.search) queryParams.search = params.search;
  if (params.field) queryParams.field = params.field;
  if (params.sortBy) queryParams.sortBy = params.sortBy;
  if (params.sortDirection) queryParams.sortDirection = params.sortDirection;
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;

  const response = await apiClient.get<UsersResponse>("/admin/list-user/all", { params: queryParams });
  return response.data;
};

/** Bulk deletes users by identifiers */
const deleteUsers = async (userIds: string[]) => {
  const response = await apiClient.post("/admin/delete-users", { userIds });
  return response.data;
};

/** Bans a user account (disables access) */
const banUser = async (userId: string) => {
  const response = await apiClient.post("/admin/ban-user", { userId });
  return response.data;
};

/** Reinstates a previously banned user account */
const unbanUser = async (userId: string) => {
  const response = await apiClient.post("/admin/unban-user", { userId });
  return response.data;
};

/** Updates user profile fields */
const updateUser = async (payload: { userId: string; data: Partial<User> }) => {
  const response = await apiClient.post("/admin/update-user", payload);
  return response.data;
};

/** Sets the user's role (affects permissions immediately) */
const setUserRole = async (payload: { userId: string; role: string }) => {
  const response = await apiClient.post("/admin/set-user-role", payload);
  return response.data;
};

/** Resets a user's password to a new value */
const resetUserPassword = async (payload: { userId: string; newPassword: string }) => {
  const response = await apiClient.post("/admin/reset-user-password", payload);
  return response.data;
};

/** Creates a new user account */
const createUser = async (payload: CreateUserPayload) => {
  const response = await apiClient.post("/admin/create-user", payload);
  return response.data;
};

// UI helpers

/** Maps backend role to display badge with standard naming */
const getRoleBadge = (role: string) => {
  switch (role) {
    case "admin":
      return <Badge className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border-transparent shadow-none">Super Admin</Badge>;
    case "trainer":
      return <Badge className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-transparent shadow-none">Training Admin</Badge>;
    case "trainee":
      return <Badge className="bg-sky-100 hover:bg-sky-200 text-sky-800 border-transparent shadow-none">Clinical Learner</Badge>;
    case "user":
      return <Badge className="bg-slate-100 hover:bg-slate-200 text-slate-800 border-transparent shadow-none">Individual Learner</Badge>;
    default:
      return <Badge variant="outline">{role}</Badge>;
  }
};

const INITIAL_NEW_USER: CreateUserPayload = {
  name: "",
  email: "",
  password: "",
  role: "user",
  accountType: "",
  phone: "",
  newsletter: true,
};

export default function AllUsersPage() {
  const { rolePath } = useParams();
  const isTrainingAdmin = rolePath === "training-admin";
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Edit User State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Role Change State
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [roleUser, setRoleUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  
  // Password Reset State
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Add User State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserCountry, setNewUserCountry] = useState<CountryCode>("AU");
  const [newUser, setNewUser] = useState<CreateUserPayload>(INITIAL_NEW_USER);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Filter, Sort & Pagination State
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState<"name" | "email">("name");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const queryClient = useQueryClient();

  // Data fetching: preserves previous page during transitions to prevent UI flicker
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["users", page, limit, search, searchField, roleFilter, sortBy, sortDirection],
    queryFn: () => fetchUsers({
      page,
      limit,
      search: search || undefined,
      field: searchField,
      role: roleFilter,
      sortBy,
      sortDirection,
    }),
    placeholderData: keepPreviousData,
  });

  const users = useMemo(() => data?.data.users ?? [], [data?.data.users]);
  const meta = data?.data.meta;

  const currentPageUserIds = useMemo(() => users.map((u) => u.id), [users]);
  const isAllCurrentPageSelected =
    currentPageUserIds.length > 0 && currentPageUserIds.every((id) => selectedUserIds.includes(id));
  const isSomeCurrentPageSelected =
    currentPageUserIds.some((id) => selectedUserIds.includes(id)) && !isAllCurrentPageSelected;

  // Mutation handlers
  const deleteMutation = useMutation({
    mutationFn: deleteUsers,
    onSuccess: (res: any) => {
      const success = res?.data?.success ?? [];
      const failed = res?.data?.failed ?? [];
      if (success.length > 0) {
        toast.success(`Deleted ${success.length} user(s)`);
      }
      if (failed.length > 0) {
        const msg = failed.map((f: any) => `${f.userId}: ${f.error}`).join(", ");
        toast.error(`Failed ${failed.length}: ${msg}`);
      }
      setIsDeleteDialogOpen(false);
      setSelectedUserIds([]);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || "Failed to delete users");
    },
  });

  const banMutation = useMutation({
    mutationFn: banUser,
    onSuccess: () => {
      toast.success("User banned successfully");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to ban user");
    },
  });

  const unbanMutation = useMutation({
    mutationFn: unbanUser,
    onSuccess: () => {
      toast.success("User unbanned successfully");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to unban user");
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      toast.success("User updated successfully");
      setIsEditOpen(false);
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to update user");
    },
  });

  const roleMutation = useMutation({
    mutationFn: setUserRole,
    onSuccess: () => {
      toast.success("User role updated successfully");
      setIsRoleOpen(false);
      setRoleUser(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to update user role");
    },
  });

  const passwordResetMutation = useMutation({
    mutationFn: resetUserPassword,
    onSuccess: () => {
      toast.success("Password reset successfully");
      setIsPasswordResetOpen(false);
      setPasswordResetUser(null);
      setNewPassword("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to reset password");
    },
  });

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      toast.success("User created successfully");
      setIsAddUserOpen(false);
      setNewUser(INITIAL_NEW_USER);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to create user");
    },
  });

  // Sorting and selection handlers
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDirection("asc");
    }
  };

  const handleSelect = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllCurrentPage = (checked: boolean | "indeterminate") => {
    if (checked) {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...currentPageUserIds])));
      return;
    }
    setSelectedUserIds((prev) => prev.filter((id) => !currentPageUserIds.includes(id)));
  };

  const handleDeleteClick = () => {
    if (selectedUserIds.length > 0) {
      setIsDeleteDialogOpen(true);
    }
  };

  const confirmDelete = () => {
    if (selectedUserIds.length > 0) {
      deleteMutation.mutate(selectedUserIds);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success("User ID copied to clipboard");
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setIsEditOpen(true);
  };

  const handleRoleClick = (user: User) => {
    setRoleUser(user);
    setNewRole(user.role);
    setIsRoleOpen(true);
  };

  const handleBanClick = (user: User) => {
    if (user.banned) {
      unbanMutation.mutate(user.id);
    } else {
      banMutation.mutate(user.id);
    }
  };

  const handlePasswordResetClick = (user: User) => {
    setPasswordResetUser(user);
    setNewPassword("");
    setIsPasswordResetOpen(true);
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    // Submits minimal profile fields; assumes editingUser is updated via inputs
    updateMutation.mutate({
      userId: editingUser.id,
      data: {
        name: editingUser.name,
        accountType: editingUser.accountType,
        phone: editingUser.phone,
      },
    });
  };

  const handleRoleUpdate = () => {
    if (roleUser && newRole) {
      roleMutation.mutate({ userId: roleUser.id, role: newRole });
    }
  };

  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordResetUser && newPassword) {
      passwordResetMutation.mutate({ userId: passwordResetUser.id, newPassword });
    }
  };

  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!newUser.name.trim()) {
      newErrors.name = "Name is required";
    } else if (/\d/.test(newUser.name)) {
      newErrors.name = "Name cannot contain numbers";
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newUser.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!emailRegex.test(newUser.email)) {
      newErrors.email = "Invalid email format";
    }

    // Password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,64}$/;
    if (!newUser.password) {
      newErrors.password = "Password is required";
    } else if (!passwordRegex.test(newUser.password)) {
      newErrors.password = "Password must be 8–64 characters and include uppercase, lowercase, number, and symbol.";
    }

    // Phone is optional
    if (!newUser.role) newErrors.role = "Role is required";
    if (!newUser.accountType) newErrors.accountType = "Account Type is required";
    
    // Phone validation
    const trimmedPhone = newUser.phone.trim();
    let formattedPhone = trimmedPhone;
    
    if (trimmedPhone) {
        if (!/^\d+$/.test(trimmedPhone)) {
            newErrors.phone = "Phone number must contain only numbers.";
        } else {
            const validationError = validatePhoneNumberLength(trimmedPhone, newUserCountry);
            if (validationError) {
                newErrors.phone = "Invalid phone number length.";
            } else {
                const parsed = parsePhoneNumberFromString(trimmedPhone, newUserCountry);
                if (parsed) {
                    formattedPhone = parsed.format('E.164');
                } else {
                    newErrors.phone = "Invalid phone number format.";
                }
            }
        }
    }

    if (Object.keys(newErrors).length > 0) {
        setFormErrors(newErrors);
        return;
    }

    createUserMutation.mutate({ 
        ...newUser, 
        name: newUser.name.trim(),
        email: newUser.email.trim(),
        phone: formattedPhone 
    });
  };

  const openAddUserDialog = () => {
    setNewUser(INITIAL_NEW_USER);
    setNewUserCountry("AU");
    setFormErrors({});
    setIsAddUserOpen(true);
  };

  const countrySelectItems = useMemo(() => {
    return getCountries().map((countryCode) => (
        <SelectItem key={countryCode} value={countryCode}>
            {countryCode} (+{getCountryCallingCode(countryCode)})
        </SelectItem>
    ))
  }, []);

  return (
    <div className="space-y-6 p-8">
      {/* Header and actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Administer user accounts, assign roles, and monitor platform access.
          </p>
        </div>
      </div>

      {/* Filters and search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8"
            />
          </div>
          <Select
            value={searchField}
            onValueChange={(val: "name" | "email") => {
              setSearchField(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Field" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={roleFilter}
            onValueChange={(val) => {
              setRoleFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <SelectValue placeholder="Role" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Super Admin</SelectItem>
              <SelectItem value="trainer">Training Admin</SelectItem>
              <SelectItem value="trainee">Clinical Learner</SelectItem>
              <SelectItem value="user">Individual Learner</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            disabled={selectedUserIds.length === 0}
            onClick={handleDeleteClick}
            className="w-[120px]"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span className="flex items-center gap-1">
              <span>Delete</span>
              {selectedUserIds.length > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-destructive-foreground/10 px-2 py-0.5 text-xs">
                  {selectedUserIds.length}
                </span>
              )}
            </span>
          </Button>
          <Button className="w-[120px]" onClick={openAddUserDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Table container */}
      <div className="rounded-md border bg-background overflow-hidden">
        <div
          className="max-h-[500px] overflow-auto relative w-full"
        >
          <table className="w-full caption-bottom text-sm border-collapse table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px] bg-background py-2">
                  {!isTrainingAdmin && (
                    <Checkbox
                      checked={isAllCurrentPageSelected ? true : isSomeCurrentPageSelected ? "indeterminate" : false}
                      onCheckedChange={handleSelectAllCurrentPage}
                      aria-label="Select all users on this page"
                    />
                  )}
                </TableHead>
                <TableHead 
                  className="w-[25%] bg-background py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center gap-1">
                    User Details
                    {sortBy === "name" && <ArrowUpDown className="h-3 w-3" />}
                  </div>
                </TableHead>
                <TableHead className="w-[15%] bg-background py-2">Role</TableHead>
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
                <TableHead className="w-[50px] bg-background py-2"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} className="p-2">
                      <Skeleton className="h-12 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="flex h-40 items-center justify-center text-destructive">
                      Error loading users: {(error as any).message}
                    </div>
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="flex h-40 items-center justify-center text-muted-foreground flex-col">
                      <Users className="h-10 w-10 mb-2 opacity-20" />
                      <p>{search ? `No users found matching "${search}"` : "No users found"}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const isSelected = selectedUserIds.includes(user.id);

                  return (
                    <TableRow
                      key={user.id}
                      className={`w-full ${isTrainingAdmin ? "" : "cursor-pointer hover:bg-muted/50"} ${isSelected ? "bg-muted" : ""}`}
                      onClick={() => {
                        if (!isTrainingAdmin) handleSelect(user.id)
                      }}
                    >
                      <TableCell className="w-[50px] py-2">
                        {!isTrainingAdmin && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleSelect(user.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${user.name}`}
                          />
                        )}
                      </TableCell>
                      <TableCell className="w-[25%] py-2">
                        <div className="flex flex-col max-w-[200px]">
                          <span className="font-medium truncate" title={user.name}>{user.name}</span>
                          <span className="text-xs text-muted-foreground truncate" title={user.email}>
                            {user.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="w-[15%] py-2">{getRoleBadge(user.role)}</TableCell>
                      <TableCell className="capitalize w-[15%] py-2">
                        {user.accountType}
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
                      <TableCell className="w-[20%] py-2">{formatRelativeTime(user.createdAt)}</TableCell>
                      <TableCell className="w-[50px] py-2">
                        {!isTrainingAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleCopyId(user.id)}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy User ID
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleEditClick(user)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRoleClick(user)}>
                                <Shield className="mr-2 h-4 w-4" />
                                Change Role
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleBanClick(user)}>
                                {user.banned ? (
                                  <>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Unban User
                                  </>
                                ) : (
                                  <>
                                    <Ban className="mr-2 h-4 w-4" />
                                    Ban User
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onClick={() => handlePasswordResetClick(user)}
                              >
                                <Lock className="mr-2 h-4 w-4" />
                                Reset Password
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {isLoading ? (
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
            disabled={!meta?.hasPrev || isLoading}
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
            disabled={!meta?.hasNext || isLoading}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Add user dialog */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddUserSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="newName">Name <span className="text-destructive">*</span></Label>
                <Input
                  id="newName"
                  value={newUser.name}
                  onChange={(e) => {
                      setNewUser({ ...newUser, name: e.target.value });
                      if(formErrors.name) setFormErrors({...formErrors, name: ""});
                  }}
                  placeholder="Enter full name"
                />
                {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="newEmail">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => {
                      setNewUser({ ...newUser, email: e.target.value });
                      if(formErrors.email) setFormErrors({...formErrors, email: ""});
                  }}
                  placeholder="name@example.com"
                />
                {formErrors.email && <p className="text-sm text-destructive">{formErrors.email}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="newPasswordInput">Password <span className="text-destructive">*</span></Label>
                <Input
                  id="newPasswordInput"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => {
                      setNewUser({ ...newUser, password: e.target.value });
                      if(formErrors.password) setFormErrors({...formErrors, password: ""});
                  }}
                  minLength={8}
                  placeholder="********"
                />
                <p className="text-xs text-muted-foreground">
                  Password must be 8–64 characters and include uppercase, lowercase, number, and symbol.
                </p>
                {formErrors.password && <p className="text-sm text-destructive">{formErrors.password}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="newPhone">Phone Number</Label>
                <div className="flex gap-2">
                  <Select value={newUserCountry} onValueChange={(value: CountryCode) => setNewUserCountry(value)}>
                    <SelectTrigger className="w-[110px]">
                      <SelectValue placeholder="Country" />
                    </SelectTrigger>
                    <SelectContent>
                      {countrySelectItems}
                    </SelectContent>
                  </Select>
                  <Input
                    id="newPhone"
                    type="tel"
                    value={newUser.phone}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^\d*$/.test(value)) {
                        setNewUser({ ...newUser, phone: value });
                        if(formErrors.phone) setFormErrors({...formErrors, phone: ""});
                      }
                    }}
                    placeholder="Enter phone number"
                  />
                </div>
                {formErrors.phone && <p className="text-sm text-destructive">{formErrors.phone}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="newRole">Role <span className="text-destructive">*</span></Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(val) => {
                          setNewUser({ ...newUser, role: val as CreateUserPayload["role"] });
                          if(formErrors.role) setFormErrors({...formErrors, role: ""});
                      }}
                    >
                      <SelectTrigger id="newRole">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Super Admin</SelectItem>
                        <SelectItem value="trainer">Training Admin</SelectItem>
                        <SelectItem value="trainee">Clinical Learner</SelectItem>
                        <SelectItem value="user">Individual Learner</SelectItem>
                      </SelectContent>
                    </Select>
                    {formErrors.role && <p className="text-sm text-destructive">{formErrors.role}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="newAccountType">Account Type <span className="text-destructive">*</span></Label>
                    <Select
                      value={newUser.accountType}
                      onValueChange={(val) => {
                          setNewUser({ ...newUser, accountType: val });
                          if(formErrors.accountType) setFormErrors({...formErrors, accountType: ""});
                      }}
                    >
                      <SelectTrigger id="newAccountType">
                        <SelectValue placeholder="Select account type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="develop">Develop</SelectItem>
                        <SelectItem value="master">Master</SelectItem>
                      </SelectContent>
                    </Select>
                    {formErrors.accountType && <p className="text-sm text-destructive">{formErrors.accountType}</p>}
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="newsletter">Newsletter</Label>
                  <div className="flex w-full items-start gap-3 rounded-md border px-4 py-3">
                    <Checkbox
                      id="newsletter"
                      checked={newUser.newsletter}
                      onCheckedChange={(checked) =>
                        setNewUser({ ...newUser, newsletter: checked === true })
                      }
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <Label htmlFor="newsletter" className="cursor-pointer">
                        Subscribe to Newsletter
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Users are subscribed to the newsletter. Uncheck to opt out.
                      </p>
                    </div>
                  </div>
                </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddUserOpen(false)}
                disabled={createUserMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the selected user accounts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Make changes to the user's profile here. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={editingUser.name}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountType">Account Type</Label>
                <Select
                  value={editingUser.accountType}
                  onValueChange={(value) =>
                    setEditingUser({ ...editingUser, accountType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="develop">Develop</SelectItem>
                    <SelectItem value="master">Master</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={editingUser.phone || ""}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, phone: e.target.value })
                  }
                  placeholder="e.g. 0412 345 678"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Role change dialog */}
      <Dialog open={isRoleOpen} onOpenChange={setIsRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Select a new role for this user. This will update their permissions immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Super Admin</SelectItem>
                  <SelectItem value="trainer">Training Admin</SelectItem>
                  <SelectItem value="trainee">Clinical Learner</SelectItem>
                  <SelectItem value="user">Individual Learner</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRoleOpen(false)}
              disabled={roleMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleRoleUpdate} 
              disabled={roleMutation.isPending}
            >
              {roleMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password reset dialog */}
      <Dialog open={isPasswordResetOpen} onOpenChange={setIsPasswordResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Reset Password</DialogTitle>
            <DialogDescription>
              This is a sensitive action. The new password will be set immediately.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Enter new password"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPasswordResetOpen(false)}
                disabled={passwordResetMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                variant="destructive"
                disabled={passwordResetMutation.isPending}
              >
                {passwordResetMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Reset Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

