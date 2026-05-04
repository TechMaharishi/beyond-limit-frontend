import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { getCountries, getCountryCallingCode, validatePhoneNumberLength, parsePhoneNumberFromString } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, Trash2, Plus, MoreHorizontal, Copy, Edit, Shield, Ban, Lock, CheckCircle,
  Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Filter,
  Users, UserCircle, Layers, Star, Pencil, AlertTriangle, Mail, MailX, Clock,
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
import { Textarea } from "@/components/ui/textarea";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// ─── Domain models ────────────────────────────────────────────────────────────

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "trainer" | "trainee" | "user";
  accountType: string;
  emailVerified: boolean;
  banned: boolean;
  banReason?: string | null;
  banExpires?: string | null;
  newsletter?: boolean;
  createdAt: string;
  phone?: string;
}

interface Profile {
  _id: string;
  userId: string;
  name: string;
  avatar: string;
  isDefault: boolean;
  createdAt?: string;
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

// ─── API service functions ────────────────────────────────────────────────────

const fetchUsers = async (params: FetchUsersParams) => {
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

const deleteUsers = async (userIds: string[]) => {
  const response = await apiClient.post("/admin/delete-users", { userIds });
  return response.data;
};

const deleteUserSingle = async (userId: string) => {
  const response = await apiClient.post("/admin/delete-user", { userId });
  return response.data;
};

const banUser = async (payload: { userId: string; banReason?: string; banExpiresIn?: string }) => {
  const response = await apiClient.post("/admin/ban-user", payload);
  return response.data;
};

const unbanUser = async (userId: string) => {
  const response = await apiClient.post("/admin/unban-user", { userId });
  return response.data;
};

const updateUser = async (payload: { userId: string; data: Partial<User> }) => {
  const response = await apiClient.post("/admin/update-user", payload);
  return response.data;
};

const setUserRole = async (payload: { userId: string; role: string }) => {
  const response = await apiClient.post("/admin/set-user-role", payload);
  return response.data;
};

const resetUserPassword = async (payload: { userId: string; newPassword: string }) => {
  const response = await apiClient.post("/admin/reset-user-password", payload);
  return response.data;
};

const createUser = async (payload: CreateUserPayload) => {
  const response = await apiClient.post("/admin/create-user", payload);
  return response.data;
};

const fetchAdminUserProfiles = async (userId: string): Promise<Profile[]> => {
  const response = await apiClient.get("/admin/user-profiles", { params: { userId } });
  return response.data?.data ?? [];
};

const createAdminProfile = async (payload: { userId: string; name: string; avatar?: string }) => {
  const response = await apiClient.post("/admin/user-profiles", payload);
  return response.data;
};

const updateAdminProfile = async (payload: { profileId: string; name?: string; avatar?: string }) => {
  const { profileId, ...data } = payload;
  const response = await apiClient.patch(`/admin/user-profiles/${profileId}`, data);
  return response.data;
};

const deleteAdminProfile = async (profileId: string) => {
  const response = await apiClient.delete(`/admin/user-profiles/${profileId}`);
  return response.data;
};

// ─── UI helpers ───────────────────────────────────────────────────────────────

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

/** Directional sort icon for table header columns */
function SortIcon({ column, sortBy, sortDirection }: { column: string; sortBy: string; sortDirection: "asc" | "desc" }) {
  if (sortBy !== column) return <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />;
  return sortDirection === "asc"
    ? <ArrowUp className="h-3 w-3" />
    : <ArrowDown className="h-3 w-3" />;
}

const BAN_EXPIRY_OPTIONS = [
  { label: "1 day", value: "1d" },
  { label: "3 days", value: "3d" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "Permanent", value: "permanent" },
];

const INITIAL_NEW_USER: CreateUserPayload = {
  name: "",
  email: "",
  password: "",
  role: "user",
  accountType: "",
  phone: "",
  newsletter: true,
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AllUsersPage() {
  const { rolePath } = useParams();
  const isTrainingAdmin = rolePath === "training-admin";
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Edit user
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Role change
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [roleUser, setRoleUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<string>("");

  // Password reset
  const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Ban with reason + expiry
  const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);
  const [banTarget, setBanTarget] = useState<User | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banExpiresIn, setBanExpiresIn] = useState("");

  // Add user
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserCountry, setNewUserCountry] = useState<CountryCode>("AU");
  const [newUser, setNewUser] = useState<CreateUserPayload>(INITIAL_NEW_USER);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Single delete
  const [isDeleteSingleOpen, setIsDeleteSingleOpen] = useState(false);
  const [deleteSingleTarget, setDeleteSingleTarget] = useState<User | null>(null);

  // Profiles sheet
  const [isProfilesOpen, setIsProfilesOpen] = useState(false);
  const [profilesUser, setProfilesUser] = useState<User | null>(null);
  const [isCreateProfileOpen, setIsCreateProfileOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editProfileName, setEditProfileName] = useState("");
  const [isDeleteProfileOpen, setIsDeleteProfileOpen] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState<Profile | null>(null);

  // Filters & pagination
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState<"name" | "email">("name");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [goToPageInput, setGoToPageInput] = useState("");

  const queryClient = useQueryClient();

  const usersQueryKey = useMemo(
    () => ["users", page, limit, search, searchField, roleFilter, sortBy, sortDirection] as const,
    [page, limit, search, searchField, roleFilter, sortBy, sortDirection]
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: usersQueryKey,
    queryFn: () => fetchUsers({ page, limit, search: search || undefined, field: searchField, role: roleFilter, sortBy, sortDirection }),
    placeholderData: keepPreviousData,
  });

  const users = useMemo(() => data?.data.users ?? [], [data?.data.users]);
  const meta = data?.data.meta;

  const currentPageUserIds = useMemo(() => users.map((u) => u.id), [users]);
  const isAllCurrentPageSelected =
    currentPageUserIds.length > 0 && currentPageUserIds.every((id) => selectedUserIds.includes(id));
  const isSomeCurrentPageSelected =
    currentPageUserIds.some((id) => selectedUserIds.includes(id)) && !isAllCurrentPageSelected;

  const hasActiveFilters = search.length > 0 || roleFilter !== "all";

  const { data: profilesData, isLoading: profilesLoading } = useQuery({
    queryKey: ["admin-profiles", profilesUser?.id],
    queryFn: () => fetchAdminUserProfiles(profilesUser!.id),
    enabled: isProfilesOpen && !!profilesUser?.id,
  });
  const profiles = profilesData ?? [];

  // ─── Mutations ────────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: deleteUsers,
    onSuccess: (res: any) => {
      const success = res?.data?.success ?? [];
      const failed = res?.data?.failed ?? [];
      if (success.length > 0) toast.success(`Deleted ${success.length} user(s)`);
      if (failed.length > 0) {
        const msg = failed.map((f: any) => `${f.userId}: ${f.error}`).join(", ");
        toast.error(`Failed ${failed.length}: ${msg}`);
      }
      setIsDeleteDialogOpen(false);
      setSelectedUserIds([]);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || err.response?.data?.message || "Failed to delete users"),
  });

  const deleteSingleMutation = useMutation({
    mutationFn: deleteUserSingle,
    onSuccess: () => {
      toast.success("User deleted successfully");
      setIsDeleteSingleOpen(false);
      setDeleteSingleTarget(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to delete user"),
  });

  // Optimistic ban — flips banned:true immediately, rolls back on error
  const banMutation = useMutation({
    mutationFn: banUser,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: usersQueryKey });
      const prev = queryClient.getQueryData(usersQueryKey);
      queryClient.setQueryData(usersQueryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            users: old.data.users.map((u: User) =>
              u.id === payload.userId ? { ...u, banned: true, banReason: payload.banReason ?? null } : u
            ),
          },
        };
      });
      return { prev };
    },
    onError: (_err: any, _vars, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(usersQueryKey, ctx.prev);
      toast.error("Failed to ban user");
    },
    onSuccess: () => {
      toast.success("User banned successfully");
      setIsBanDialogOpen(false);
      setBanTarget(null);
      setBanReason("");
      setBanExpiresIn("");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  // Optimistic unban — flips banned:false immediately, rolls back on error
  const unbanMutation = useMutation({
    mutationFn: unbanUser,
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: usersQueryKey });
      const prev = queryClient.getQueryData(usersQueryKey);
      queryClient.setQueryData(usersQueryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: {
            ...old.data,
            users: old.data.users.map((u: User) =>
              u.id === userId ? { ...u, banned: false, banReason: null, banExpires: null } : u
            ),
          },
        };
      });
      return { prev };
    },
    onError: (_err: any, _vars, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(usersQueryKey, ctx.prev);
      toast.error("Failed to unban user");
    },
    onSuccess: () => toast.success("User unbanned successfully"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const updateMutation = useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      toast.success("User updated successfully");
      setIsEditOpen(false);
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to update user"),
  });

  const roleMutation = useMutation({
    mutationFn: setUserRole,
    onSuccess: () => {
      toast.success("User role updated successfully");
      setIsRoleOpen(false);
      setRoleUser(null);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to update user role"),
  });

  const passwordResetMutation = useMutation({
    mutationFn: resetUserPassword,
    onSuccess: () => {
      toast.success("Password reset successfully");
      setIsPasswordResetOpen(false);
      setPasswordResetUser(null);
      setNewPassword("");
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to reset password"),
  });

  const createUserMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      toast.success("User created successfully");
      setIsAddUserOpen(false);
      setNewUser(INITIAL_NEW_USER);
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to create user"),
  });

  const createProfileMutation = useMutation({
    mutationFn: createAdminProfile,
    onSuccess: () => {
      toast.success("Profile created");
      setIsCreateProfileOpen(false);
      setNewProfileName("");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles", profilesUser?.id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to create profile"),
  });

  const updateProfileMutation = useMutation({
    mutationFn: updateAdminProfile,
    onSuccess: () => {
      toast.success("Profile updated");
      setIsEditProfileOpen(false);
      setEditingProfile(null);
      queryClient.invalidateQueries({ queryKey: ["admin-profiles", profilesUser?.id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to update profile"),
  });

  const deleteProfileMutation = useMutation({
    mutationFn: deleteAdminProfile,
    onSuccess: () => {
      toast.success("Profile deleted");
      setIsDeleteProfileOpen(false);
      setDeletingProfile(null);
      queryClient.invalidateQueries({ queryKey: ["admin-profiles", profilesUser?.id] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Failed to delete profile"),
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSort = (field: string) => {
    if (sortBy === field) setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDirection("asc"); }
  };

  const handleSelect = (userId: string) =>
    setSelectedUserIds((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);

  const handleSelectAllCurrentPage = (checked: boolean | "indeterminate") => {
    if (checked) setSelectedUserIds((prev) => Array.from(new Set([...prev, ...currentPageUserIds])));
    else setSelectedUserIds((prev) => prev.filter((id) => !currentPageUserIds.includes(id)));
  };

  const handleCopyId = (id: string) => { navigator.clipboard.writeText(id); toast.success("User ID copied to clipboard"); };
  const handleEditClick = (user: User) => { setEditingUser({ ...user }); setIsEditOpen(true); };
  const handleRoleClick = (user: User) => { setRoleUser(user); setNewRole(user.role); setIsRoleOpen(true); };

  const handleBanClick = (user: User) => {
    if (user.banned) {
      unbanMutation.mutate(user.id);
    } else {
      setBanTarget(user);
      setBanReason("");
      setBanExpiresIn("");
      setIsBanDialogOpen(true);
    }
  };

  const handleConfirmBan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!banTarget) return;
    banMutation.mutate({
      userId: banTarget.id,
      banReason: banReason.trim() || undefined,
      banExpiresIn: banExpiresIn && banExpiresIn !== "permanent" ? banExpiresIn : undefined,
    });
  };

  const handlePasswordResetClick = (user: User) => { setPasswordResetUser(user); setNewPassword(""); setShowNewPassword(false); setIsPasswordResetOpen(true); };
  const handleDeleteSingleClick = (user: User) => { setDeleteSingleTarget(user); setIsDeleteSingleOpen(true); };
  const handleManageProfilesClick = (user: User) => { setProfilesUser(user); setIsProfilesOpen(true); };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    updateMutation.mutate({
      userId: editingUser.id,
      data: { name: editingUser.name, accountType: editingUser.accountType, phone: editingUser.phone, newsletter: editingUser.newsletter },
    });
  };

  const handleRoleUpdate = () => {
    if (roleUser && newRole) roleMutation.mutate({ userId: roleUser.id, role: newRole });
  };

  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordResetUser && newPassword) passwordResetMutation.mutate({ userId: passwordResetUser.id, newPassword });
  };

  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    const newErrors: Record<string, string> = {};

    if (!newUser.name.trim()) newErrors.name = "Name is required";
    else if (/\d/.test(newUser.name)) newErrors.name = "Name cannot contain numbers";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newUser.email.trim()) newErrors.email = "Email is required";
    else if (!emailRegex.test(newUser.email)) newErrors.email = "Invalid email format";

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,64}$/;
    if (!newUser.password) newErrors.password = "Password is required";
    else if (!passwordRegex.test(newUser.password)) newErrors.password = "Password must be 8–64 characters and include uppercase, lowercase, number, and symbol.";

    if (!newUser.role) newErrors.role = "Role is required";
    if (!newUser.accountType) newErrors.accountType = "Account Type is required";

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
          if (parsed) formattedPhone = parsed.format("E.164");
          else newErrors.phone = "Invalid phone number format.";
        }
      }
    }

    if (Object.keys(newErrors).length > 0) { setFormErrors(newErrors); return; }
    createUserMutation.mutate({ ...newUser, name: newUser.name.trim(), email: newUser.email.trim(), phone: formattedPhone });
  };

  const openAddUserDialog = () => { setNewUser(INITIAL_NEW_USER); setNewUserCountry("AU"); setFormErrors({}); setIsAddUserOpen(true); };

  const countrySelectItems = useMemo(() =>
    getCountries().map((countryCode) => (
      <SelectItem key={countryCode} value={countryCode}>
        {countryCode} (+{getCountryCallingCode(countryCode)})
      </SelectItem>
    )), []);

  const handleGoToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(goToPageInput, 10);
    if (!isNaN(n) && meta && n >= 1 && n <= meta.totalPages) {
      setPage(n);
      setGoToPageInput("");
    }
  };

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profilesUser || !newProfileName.trim()) return;
    createProfileMutation.mutate({ userId: profilesUser.id, name: newProfileName.trim() });
  };

  const handleEditProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile || !editProfileName.trim()) return;
    updateProfileMutation.mutate({ profileId: editingProfile._id, name: editProfileName.trim() });
  };

  const openEditProfile = (profile: Profile) => { setEditingProfile(profile); setEditProfileName(profile.name); setIsEditProfileOpen(true); };
  const openDeleteProfile = (profile: Profile) => { setDeletingProfile(profile); setIsDeleteProfileOpen(true); };

  const clearFilters = () => { setSearch(""); setRoleFilter("all"); setPage(1); };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">Administer user accounts, assign roles, and monitor platform access.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-8" />
          </div>
          <Select value={searchField} onValueChange={(val: "name" | "email") => { setSearchField(val); setPage(1); }}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Field" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={(val) => { setRoleFilter(val); setPage(1); }}>
            <SelectTrigger className="w-[150px]">
              <div className="flex items-center gap-2"><Filter className="h-4 w-4" /><SelectValue placeholder="Role" /></div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Super Admin</SelectItem>
              <SelectItem value="trainer">Training Admin</SelectItem>
              <SelectItem value="trainee">Clinical Learner</SelectItem>
              <SelectItem value="user">Individual Learner</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground">
              Clear filters
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="destructive" disabled={selectedUserIds.length === 0} onClick={() => selectedUserIds.length > 0 && setIsDeleteDialogOpen(true)} className="w-[120px]">
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
            <Plus className="mr-2 h-4 w-4" />Add User
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-background overflow-hidden">
        <div className="max-h-[500px] overflow-auto relative w-full">
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
                <TableHead className="w-[25%] bg-background py-2 cursor-pointer select-none hover:bg-muted/50 transition-colors" onClick={() => handleSort("name")}>
                  <div className="flex items-center gap-1">
                    User Details
                    <SortIcon column="name" sortBy={sortBy} sortDirection={sortDirection} />
                  </div>
                </TableHead>
                <TableHead className="w-[15%] bg-background py-2">Role</TableHead>
                <TableHead className="w-[15%] bg-background py-2">Account Type</TableHead>
                <TableHead className="w-[10%] bg-background py-2">Verified</TableHead>
                <TableHead className="w-[10%] bg-background py-2">Status</TableHead>
                <TableHead className="w-[20%] bg-background py-2 cursor-pointer select-none hover:bg-muted/50 transition-colors" onClick={() => handleSort("createdAt")}>
                  <div className="flex items-center gap-1">
                    Created At
                    <SortIcon column="createdAt" sortBy={sortBy} sortDirection={sortDirection} />
                  </div>
                </TableHead>
                <TableHead className="w-[50px] bg-background py-2" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} className="p-2"><Skeleton className="h-12 w-full" /></TableCell>
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
                    <div className="flex h-40 items-center justify-center flex-col gap-2 text-muted-foreground">
                      <Users className="h-10 w-10 opacity-20" />
                      {hasActiveFilters ? (
                        <>
                          <p className="font-medium text-foreground">No users match your filters</p>
                          <p className="text-sm">Try adjusting your search or role filter.</p>
                          <Button variant="outline" size="sm" onClick={clearFilters} className="mt-1">
                            Clear filters
                          </Button>
                        </>
                      ) : (
                        <p>No users yet</p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const isSelected = selectedUserIds.includes(user.id);
                  return (
                    <TableRow
                      key={user.id}
                      className={[
                        "w-full",
                        isTrainingAdmin ? "" : "cursor-pointer hover:bg-muted/50",
                        isSelected ? "bg-muted" : "",
                        // #9 — banned rows get a red left border for instant visual scan
                        user.banned ? "border-l-2 border-l-red-400" : "border-l-2 border-l-transparent",
                      ].join(" ")}
                      onClick={() => { if (!isTrainingAdmin) handleSelect(user.id); }}
                    >
                      <TableCell className="w-[50px] py-2">
                        {!isTrainingAdmin && (
                          <Checkbox checked={isSelected} onCheckedChange={() => handleSelect(user.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${user.name}`} />
                        )}
                      </TableCell>

                      {/* #5 — newsletter indicator in user details cell */}
                      <TableCell className="w-[25%] py-2">
                        <div className="flex flex-col max-w-[200px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium truncate" title={user.name}>{user.name}</span>
                            {user.newsletter === true && (
                              <span title="Subscribed to newsletter">
                                <Mail className="h-3 w-3 shrink-0 text-sky-500" />
                              </span>
                            )}
                            {user.newsletter === false && (
                              <span title="Not subscribed to newsletter">
                                <MailX className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground truncate" title={user.email}>{user.email}</span>
                        </div>
                      </TableCell>

                      {/* #6 — profiles icon directly visible for Individual Learners */}
                      <TableCell className="w-[15%] py-2">
                        <div className="flex items-center gap-1.5">
                          {getRoleBadge(user.role)}
                          {user.role === "user" && (
                            <button
                              type="button"
                              title="Manage profiles"
                              className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              onClick={(e) => { e.stopPropagation(); handleManageProfilesClick(user); }}
                            >
                              <Layers className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="capitalize w-[15%] py-2">{user.accountType}</TableCell>
                      <TableCell className="w-[10%] py-2">
                        {user.emailVerified ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50">Verified</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="w-[10%] py-2">
                        {user.banned ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-transparent shadow-none w-fit">Banned</Badge>
                            {user.banReason && (
                              <span className="text-xs text-muted-foreground truncate max-w-[100px]" title={user.banReason}>{user.banReason}</span>
                            )}
                          </div>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-transparent shadow-none">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="w-[20%] py-2">{formatRelativeTime(user.createdAt)}</TableCell>
                      <TableCell className="w-[50px] py-2">
                        {!isTrainingAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyId(user.id); }}>
                                <Copy className="mr-2 h-4 w-4" />Copy User ID
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditClick(user); }}>
                                <Edit className="mr-2 h-4 w-4" />Edit User
                              </DropdownMenuItem>
                              {user.role !== "user" && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRoleClick(user); }}>
                                  <Shield className="mr-2 h-4 w-4" />Change Role
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleBanClick(user); }}>
                                {user.banned
                                  ? <><CheckCircle className="mr-2 h-4 w-4" />Unban User</>
                                  : <><Ban className="mr-2 h-4 w-4" />Ban User</>}
                              </DropdownMenuItem>
                              {user.role === "user" && (
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleManageProfilesClick(user); }}>
                                  <Layers className="mr-2 h-4 w-4" />Manage Profiles
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); handlePasswordResetClick(user); }}>
                                <Lock className="mr-2 h-4 w-4" />Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteSingleClick(user); }}>
                                <Trash2 className="mr-2 h-4 w-4" />Delete User
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
          {isLoading ? "Loading..." : meta && meta.total > 0 ? (
            <>Showing {Math.min((meta.page - 1) * meta.limit + 1, meta.total)} to {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} users</>
          ) : "Showing 0 to 0 of 0 users"}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-2">
            <span className="text-sm text-muted-foreground">Rows</span>
            <Select value={limit.toString()} onValueChange={(val) => { setLimit(Number(val)); setPage(1); }}>
              <SelectTrigger className="h-8 w-[70px]"><SelectValue placeholder={limit} /></SelectTrigger>
              <SelectContent side="top">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!meta?.hasPrev || isLoading}>
            <ChevronLeft className="h-4 w-4" />Previous
          </Button>
          <div className="text-sm font-medium">Page {meta?.page || 1} of {meta?.totalPages || 1}</div>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!meta?.hasNext || isLoading}>
            Next<ChevronRight className="h-4 w-4" />
          </Button>
          {/* #10 — Go to page input */}
          {meta && meta.totalPages > 2 && (
            <form onSubmit={handleGoToPage} className="flex items-center gap-1 ml-2">
              <Input
                className="h-8 w-14 text-center text-sm"
                placeholder="pg."
                value={goToPageInput}
                onChange={(e) => setGoToPageInput(e.target.value)}
                type="number"
                min={1}
                max={meta.totalPages}
              />
              <Button type="submit" variant="outline" size="sm" className="h-8 px-2">Go</Button>
            </form>
          )}
        </div>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────────────── */}

      {/* Add user */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddUserSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="newName">Name <span className="text-destructive">*</span></Label>
              <Input id="newName" value={newUser.name} onChange={(e) => { setNewUser({ ...newUser, name: e.target.value }); if (formErrors.name) setFormErrors({ ...formErrors, name: "" }); }} placeholder="Enter full name" />
              {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="newEmail">Email <span className="text-destructive">*</span></Label>
              <Input id="newEmail" type="email" value={newUser.email} onChange={(e) => { setNewUser({ ...newUser, email: e.target.value }); if (formErrors.email) setFormErrors({ ...formErrors, email: "" }); }} placeholder="name@example.com" />
              {formErrors.email && <p className="text-sm text-destructive">{formErrors.email}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="newPasswordInput">Password <span className="text-destructive">*</span></Label>
              <Input id="newPasswordInput" type="password" value={newUser.password} onChange={(e) => { setNewUser({ ...newUser, password: e.target.value }); if (formErrors.password) setFormErrors({ ...formErrors, password: "" }); }} minLength={8} placeholder="********" />
              <p className="text-xs text-muted-foreground">Password must be 8–64 characters and include uppercase, lowercase, number, and symbol.</p>
              {formErrors.password && <p className="text-sm text-destructive">{formErrors.password}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="newPhone">Phone Number</Label>
              <div className="flex gap-2">
                <Select value={newUserCountry} onValueChange={(value: CountryCode) => setNewUserCountry(value)}>
                  <SelectTrigger className="w-[110px]"><SelectValue placeholder="Country" /></SelectTrigger>
                  <SelectContent>{countrySelectItems}</SelectContent>
                </Select>
                <Input id="newPhone" type="tel" value={newUser.phone} onChange={(e) => { const value = e.target.value; if (/^\d*$/.test(value)) { setNewUser({ ...newUser, phone: value }); if (formErrors.phone) setFormErrors({ ...formErrors, phone: "" }); } }} placeholder="Enter phone number" />
              </div>
              {formErrors.phone && <p className="text-sm text-destructive">{formErrors.phone}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="newRole">Role <span className="text-destructive">*</span></Label>
                <Select value={newUser.role} onValueChange={(val) => { setNewUser({ ...newUser, role: val as CreateUserPayload["role"] }); if (formErrors.role) setFormErrors({ ...formErrors, role: "" }); }}>
                  <SelectTrigger id="newRole"><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Super Admin</SelectItem>
                    <SelectItem value="trainer">Training Admin</SelectItem>
                    <SelectItem value="trainee">Clinical Learner</SelectItem>
                    <SelectItem value="user">Individual Learner</SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.role && <p className="text-sm text-destructive">{formErrors.role}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="newAccountType">Account Type <span className="text-destructive">*</span></Label>
                <Select value={newUser.accountType} onValueChange={(val) => { setNewUser({ ...newUser, accountType: val }); if (formErrors.accountType) setFormErrors({ ...formErrors, accountType: "" }); }}>
                  <SelectTrigger id="newAccountType"><SelectValue placeholder="Select account type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="develop">Develop</SelectItem>
                    <SelectItem value="master">Master</SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.accountType && <p className="text-sm text-destructive">{formErrors.accountType}</p>}
              </div>
              <div className="col-span-2 flex flex-col gap-2">
                <Label>Newsletter</Label>
                <div className="flex w-full items-start gap-3 rounded-md border px-4 py-3">
                  <Checkbox id="newsletter" checked={newUser.newsletter} onCheckedChange={(checked) => setNewUser({ ...newUser, newsletter: checked === true })} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="newsletter" className="cursor-pointer">Subscribe to Newsletter</Label>
                    <p className="text-sm text-muted-foreground mt-1">Uncheck to opt out of marketing emails.</p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)} disabled={createUserMutation.isPending}>Cancel</Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk delete */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedUserIds.length} user{selectedUserIds.length !== 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>This action cannot be undone. The selected accounts will be permanently deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate(selectedUserIds)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single delete */}
      <Dialog open={isDeleteSingleOpen} onOpenChange={setIsDeleteSingleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{deleteSingleTarget?.name}</span> ({deleteSingleTarget?.email}) will be permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteSingleOpen(false)} disabled={deleteSingleMutation.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteSingleTarget && deleteSingleMutation.mutate(deleteSingleTarget.id)} disabled={deleteSingleMutation.isPending}>
              {deleteSingleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit user — includes newsletter toggle */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Make changes to the user's profile. Click save when done.</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={editingUser.name} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="accountType">Account Type</Label>
                <Select value={editingUser.accountType} onValueChange={(value) => setEditingUser({ ...editingUser, accountType: value })}>
                  <SelectTrigger><SelectValue placeholder="Select account type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="develop">Develop</SelectItem>
                    <SelectItem value="master">Master</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={editingUser.phone || ""} onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })} placeholder="e.g. +61412345678" />
              </div>
              {/* #5 — newsletter toggle in edit form */}
              <div className="flex items-center justify-between rounded-md border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Newsletter</p>
                  <p className="text-xs text-muted-foreground">Marketing and update emails</p>
                </div>
                <Checkbox
                  checked={editingUser.newsletter ?? false}
                  onCheckedChange={(checked) => setEditingUser({ ...editingUser, newsletter: checked === true })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={updateMutation.isPending}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Change role */}
      <Dialog open={isRoleOpen} onOpenChange={setIsRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>Select a new role for this user. Permissions update immediately.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
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
            <Button variant="outline" onClick={() => setIsRoleOpen(false)} disabled={roleMutation.isPending}>Cancel</Button>
            <Button onClick={handleRoleUpdate} disabled={roleMutation.isPending}>
              {roleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* #3 — Ban with reason + expiry */}
      <Dialog open={isBanDialogOpen} onOpenChange={setIsBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Ban User
            </DialogTitle>
            <DialogDescription>
              Banning <span className="font-medium text-foreground">{banTarget?.name}</span> will prevent them from signing in.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmBan} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="banDuration" className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />Duration
              </Label>
              <Select value={banExpiresIn} onValueChange={setBanExpiresIn}>
                <SelectTrigger id="banDuration"><SelectValue placeholder="Select duration" /></SelectTrigger>
                <SelectContent>
                  {BAN_EXPIRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="banReason">Reason <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                id="banReason"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Describe the reason for this ban…"
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground text-right">{banReason.length}/200</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsBanDialogOpen(false)} disabled={banMutation.isPending}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={banMutation.isPending}>
                {banMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ban User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={isPasswordResetOpen} onOpenChange={setIsPasswordResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Reset Password</DialogTitle>
            <DialogDescription>The new password will be set immediately for <span className="font-medium text-foreground">{passwordResetUser?.name}</span>.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordReset} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Enter new password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-muted-foreground"
                  onClick={() => setShowNewPassword((v) => !v)}
                >
                  {showNewPassword ? "Hide" : "Show"}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPasswordResetOpen(false)} disabled={passwordResetMutation.isPending}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={passwordResetMutation.isPending}>
                {passwordResetMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Reset Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Profiles sheet ────────────────────────────────────────────────────── */}

      <Sheet open={isProfilesOpen} onOpenChange={(open) => {
        setIsProfilesOpen(open);
        if (!open) { setIsCreateProfileOpen(false); setIsEditProfileOpen(false); setIsDeleteProfileOpen(false); }
      }}>
        <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />Manage Profiles
            </SheetTitle>
            <SheetDescription>
              Sub-profiles for <span className="font-medium text-foreground">{profilesUser?.name}</span>. Up to 5 profiles allowed.
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
            {isCreateProfileOpen ? (
              <form onSubmit={handleCreateProfile} className="flex flex-col gap-3 rounded-lg border p-4 bg-muted/30">
                <p className="text-sm font-medium">New Profile</p>
                <Input autoFocus value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} placeholder="Profile name" maxLength={50} />
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={!newProfileName.trim() || createProfileMutation.isPending}>
                    {createProfileMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Create
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setIsCreateProfileOpen(false); setNewProfileName(""); }}>Cancel</Button>
                </div>
              </form>
            ) : (
              <Button variant="outline" size="sm" className="w-full" disabled={profiles.length >= 5} onClick={() => setIsCreateProfileOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {profiles.length >= 5 ? "Maximum 5 profiles reached" : "Add Profile"}
              </Button>
            )}
            {profilesLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : profiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <UserCircle className="h-10 w-10 opacity-20" />
                <p className="text-sm">No profiles yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {profiles.map((profile) => (
                  <div key={profile._id} className="flex items-center justify-between rounded-lg border p-3 bg-background hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                        {profile.avatar
                          ? <img src={profile.avatar} alt={profile.name} className="size-full object-cover" />
                          : <UserCircle className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm truncate">{profile.name}</span>
                          {profile.isDefault && (
                            <Badge className="bg-amber-100 text-amber-800 border-transparent shadow-none text-xs py-0 px-1.5 h-4 shrink-0">
                              <Star className="h-2.5 w-2.5 mr-0.5" />Default
                            </Badge>
                          )}
                        </div>
                        {profile.createdAt && <p className="text-xs text-muted-foreground">{formatRelativeTime(profile.createdAt)}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {isEditProfileOpen && editingProfile?._id === profile._id ? (
                        <form onSubmit={handleEditProfileSubmit} className="flex items-center gap-1">
                          <Input autoFocus value={editProfileName} onChange={(e) => setEditProfileName(e.target.value)} className="h-7 w-32 text-sm" maxLength={50} />
                          <Button type="submit" size="sm" variant="ghost" className="h-7 px-2" disabled={!editProfileName.trim() || updateProfileMutation.isPending}>
                            {updateProfileMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                          </Button>
                          <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setIsEditProfileOpen(false); setEditingProfile(null); }}>✕</Button>
                        </form>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEditProfile(profile)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => openDeleteProfile(profile)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete profile confirmation */}
      <Dialog open={isDeleteProfileOpen} onOpenChange={setIsDeleteProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />Delete profile?
            </DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">"{deletingProfile?.name}"</span> will be permanently removed.
              {deletingProfile?.isDefault && " This is the default profile — deleting it may affect the user's active session."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteProfileOpen(false)} disabled={deleteProfileMutation.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => deletingProfile && deleteProfileMutation.mutate(deletingProfile._id)} disabled={deleteProfileMutation.isPending}>
              {deleteProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
