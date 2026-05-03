
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Trash2, Search, AlertCircle, ArrowUpDown, ChevronLeft, ChevronRight, Plus, Filter, MoreVertical, Copy, Edit, CheckCircle } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useChangeStatus } from "@/hooks/use-course";
import { formatRelativeTime } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

/** Types used by course listing and management. */

interface User {
  _id: string;
  name: string;
  email: string;
}

interface Course {
  _id: string;
  title: string;
  description: string;
  tags: string[];
  status: "published" | "pending" | "rejected" | "draft";
  accessLevel: string;
  createdBy: User;
  thumbnailUrl: string;
  totalDurationSeconds: number;
  totalQuizzes: number;
  totalChapters: number;
  createdAt: string;
  updatedAt: string;
}

interface CoursesResponse {
  success: boolean;
  message: string;
  data: Course[];
  meta: {
    page: number;
    offset: number;
    limit: number;
    total: number;
    hasNext: boolean;
  };
}

interface CoursesManagerProps {
  pageTitle: string;
  defaultStatus: string; // "published" | "pending" | "draft"
  allowedStatuses?: string[]; // e.g. ["pending", "rejected"]
  showStatusFilter?: boolean;
  hideAddButton?: boolean;
}

/** Formats a duration in seconds into a user-friendly string (e.g., "1h 5m 3s"). */

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  return `${m}m ${s}s`;
};

/** Maps course status to the corresponding badge variant used by the UI. */
const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "published": return "default";
    case "pending": return "secondary";
    case "rejected": return "destructive";
    case "draft": return "outline";
    default: return "secondary";
  }
};

/** API helpers */

const fetchCourses = async ({ page, limit, status, search, sortBy, sortOrder }: any) => {
  const params: any = {
    page,
    limit,
  };
  
  if (status) params.status = status;
  if (search) params.q = search;
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.order = sortOrder;

  const response = await apiClient.get<CoursesResponse>("/courses", { params });
  return response.data;
};

const deleteCourse = async (id: string) => {
  const response = await apiClient.delete(`/courses/${id}`);
  return response.data;
};

/** Course list manager with debounced search, pagination, and status actions. */
export function CoursesManager({ 
  pageTitle, 
  defaultStatus, 
  allowedStatuses, 
  showStatusFilter,
  hideAddButton
}: CoursesManagerProps) {
  // Local state for filters, selection, and pagination.
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState(defaultStatus);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Navigation and mutations.
  const { rolePath } = useParams();
  const navigate = useNavigate();
  const changeStatusMutation = useChangeStatus();
  
  // Pagination state; default rows per page can be adjusted by the user.
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10); // Default to 10 to match design, can be 20

  // Debounced search; resets to page 1 when the search term changes.
  useEffect(() => {
    const timer = setTimeout(() => {
        setDebouncedSearch(search);
        setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Clear selection when filters or page change to avoid acting on stale selection.
  useEffect(() => {
    setSelectedId(null);
  }, [status, debouncedSearch, page]);

  const parentRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Query with pagination and sorting; keeps previous data for smoother UI transitions.
  const { data, isLoading, isError } = useQuery({
    queryKey: ["courses", page, limit, status, debouncedSearch, sortBy, sortOrder],
    queryFn: () => fetchCourses({ 
        page, 
        limit, 
        status, 
        search: debouncedSearch,
        sortBy,
        sortOrder
    }),
    placeholderData: keepPreviousData,
  });

  const courses = data?.data || [];
  const meta = data?.meta;
  const totalItems = meta?.total || 0;
  const totalPages = Math.ceil(totalItems / limit);

  // Delete mutation with cache invalidation and user feedback.
  const deleteMutation = useMutation({
    mutationFn: deleteCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedId(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to delete course");
    },
  });

  // UI event handlers.
  const handleDeleteClick = () => {
    if (selectedId) setIsDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (selectedId) deleteMutation.mutate(selectedId);
  };

  const handleSelect = (id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
        setSortBy(field);
        setSortOrder("asc");
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success("Course ID copied to clipboard");
  };

  const handleEdit = (id: string) => {
    navigate(rolePath ? `/${rolePath}/content/courses/${id}/edit` : `/content/courses/${id}/edit`);
  };

  const handlePublish = (id: string) => {
    changeStatusMutation.mutate({ courseId: id, status: 'published' }, {
        onSuccess: () => toast.success("Course published successfully"),
        onError: () => toast.error("Failed to publish course")
    });
  };

  const openDeleteDialogFor = (id: string) => {
    setSelectedId(id);
    setIsDeleteDialogOpen(true);
  };

  const handleAddCourse = () => {
    navigate(rolePath ? `/${rolePath}/content/courses/create` : `/content/courses/create`);
  };

  return (
    <div className="space-y-6 p-8 h-full flex flex-col overflow-hidden">
      {/* Header section */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
        <p className="text-muted-foreground mt-1">
          Manage courses
        </p>
      </div>

      {/* Toolbar with search and optional status filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center space-x-2">
             <div className="relative w-full sm:w-72">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search courses..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                />
            </div>
            
            {showStatusFilter && allowedStatuses && (
                <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-[150px]">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4" />
                            <SelectValue placeholder="Status" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                        {allowedStatuses.map(s => (
                            <SelectItem key={s} value={s} className="capitalize">
                                {s}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}
        </div>

        <div className="flex items-center gap-2">
           <Button 
                variant="destructive" 
                disabled={!selectedId} 
                onClick={handleDeleteClick}
                className="w-[100px]"
            >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
            </Button>
            {!hideAddButton && (
                <Button className="w-[140px]" onClick={handleAddCourse}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Course
                </Button>
            )}
        </div>
      </div>

      {/* Table container with standard rows */}
      <div className="rounded-md border bg-background overflow-hidden">
        <div 
            ref={parentRef} 
            className="max-h-[500px] overflow-auto relative w-full"
        >
            <table className="w-full caption-bottom text-sm border-collapse table-fixed">
              <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[50px] bg-background py-2"></TableHead>
                  <TableHead 
                    className="w-[20%] bg-background py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSort("title")}
                  >
                    <div className="flex items-center gap-1">
                      Title
                      {sortBy === "title" && <ArrowUpDown className="h-3 w-3" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-[10%] bg-background py-2">Status</TableHead>
                  <TableHead className="w-[10%] bg-background py-2">Access</TableHead>
                  <TableHead className="w-[15%] bg-background py-2">Tags</TableHead>
                  <TableHead className="w-[10%] bg-background py-2">Duration</TableHead>
                  <TableHead className="w-[15%] bg-background py-2">Created By</TableHead>
                  <TableHead 
                    className="w-[10%] bg-background py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSort("createdAt")}
                  >
                    <div className="flex items-center gap-1">
                      Created At
                      {sortBy === "createdAt" && <ArrowUpDown className="h-3 w-3" />}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="w-[10%] bg-background py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSort("updatedAt")}
                  >
                    <div className="flex items-center gap-1">
                      Updated At
                      {sortBy === "updatedAt" && <ArrowUpDown className="h-3 w-3" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-[50px] bg-background py-2"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10} className="p-2">
                        <Skeleton className="h-12 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <div className="flex h-40 items-center justify-center text-destructive">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <AlertCircle className="h-8 w-8" />
                          <p>Failed to load courses</p>
                          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["courses"] })}>
                            Retry
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : courses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <div className="flex h-40 items-center justify-center text-muted-foreground">
                        No courses found
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  courses.map((course) => (
                    <ContextMenu key={course._id}>
                      <ContextMenuTrigger asChild>
                        <TableRow 
                          className={`cursor-pointer hover:bg-muted/50 ${selectedId === course._id ? "bg-muted" : ""}`}
                          onClick={() => handleEdit(course._id)}
                        >
                          <TableCell
                            className="py-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox 
                              checked={selectedId === course._id}
                              onCheckedChange={() => handleSelect(course._id)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Select ${course.title}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium truncate py-2" title={course.title}>
                            {course.title}
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant={getStatusBadgeVariant(course.status)}>
                              {course.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant="outline" className="capitalize">
                              {course.accessLevel}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex flex-col gap-1">
                              {course.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs w-fit">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground py-2">
                            {formatDuration(course.totalDurationSeconds)}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex flex-col">
                              <span className="font-medium truncate" title={course.createdBy?.name || "Unknown"}>
                                {course.createdBy?.name || "Unknown"}
                              </span>
                              <span className="text-xs text-muted-foreground truncate" title={course.createdBy?.email}>
                                {course.createdBy?.email}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground py-2">
                            {formatRelativeTime(course.createdAt)}
                          </TableCell>
                          <TableCell className="text-muted-foreground py-2">
                            {formatRelativeTime(course.updatedAt)}
                          </TableCell>
                          <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleCopyId(course._id)}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copy ID
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(course._id)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                {course.status === 'pending' && rolePath === 'super-admin' && (
                                  <DropdownMenuItem onClick={() => handlePublish(course._id)}>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Publish
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => openDeleteDialogFor(course._id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onSelect={() => handleEdit(course._id)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </ContextMenuItem>
                        {course.status === 'pending' && rolePath === 'super-admin' && (
                          <ContextMenuItem onSelect={() => handlePublish(course._id)}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Publish
                          </ContextMenuItem>
                        )}
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          variant="destructive"
                          onSelect={() => openDeleteDialogFor(course._id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))
                )}
              </TableBody>
            </table>
        </div>
      </div>

      {/* Pagination controls and rows-per-page selector */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
            {isLoading ? (
                "Loading..."
            ) : totalItems > 0 ? (
                <>
                    Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalItems)} of {totalItems} courses
                </>
            ) : (
                "Showing 0 to 0 of 0 courses"
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
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
            >
                <ChevronLeft className="h-4 w-4" />
                Previous
            </Button>
             <div className="text-sm font-medium">
                Page {page} of {totalPages || 1}
            </div>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages || isLoading}
            >
                Next
                <ChevronRight className="h-4 w-4" />
            </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Delete Course</DialogTitle>
                <DialogDescription>
                    Are you sure you want to delete this course? This action cannot be undone.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                <Button 
                    variant="destructive" 
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                >
                    {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
