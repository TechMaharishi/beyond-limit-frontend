import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, AlertCircle, Search, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

// API models and service calls
interface TicketType {
  _id: string;
  name: string;
  slug: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TicketTypesResponse {
  success: boolean;
  message: string;
  data: TicketType[];
  meta: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
  };
}

interface CreateTicketTypePayload {
  name: string;
  description: string;
}

interface FetchTicketTypesParams {
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * Fetches all ticket types from the backend.
 * Used for populating the administration list.
 */
const getTicketTypes = async (params: FetchTicketTypesParams = {}) => {
  const queryParams: Record<string, any> = {};
  if (params.page) queryParams.page = params.page;
  if (params.limit) queryParams.limit = params.limit;
  if (params.search) queryParams.search = params.search;

  const response = await apiClient.get<TicketTypesResponse>("/support/ticket-types", { params: queryParams });
  return response.data;
};

/**
 * Creates a new ticket type.
 * 
 * @param payload - The ticket type details (name, description).
 * @returns The created ticket type object.
 */
const createTicketType = async (payload: CreateTicketTypePayload) => {
  const response = await apiClient.post("/support/create-ticket-type", payload);
  return response.data;
};

/**
 * Deletes a ticket type by its unique identifier.
 * 
 * @param id - The ID of the ticket type to delete.
 */
const deleteTicketType = async (id: string) => {
  const response = await apiClient.delete(`/support/delete-ticket-type/${id}`);
  return response.data;
};

export function TicketTypesPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Search & Pagination State
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Data fetching
  const { data: response, isLoading, isError } = useQuery({
    queryKey: ["ticketTypes", page, limit, search],
    queryFn: () => getTicketTypes({ page, limit, search }),
    placeholderData: keepPreviousData,
  });

  const ticketTypes = useMemo(() => response?.data || [], [response]);
  const meta = useMemo(() => response?.meta, [response]);

  // Mutations
  
  /**
   * Mutation for creating a ticket type.
   * On success: Invalidates the list query to refetch data and closes the dialog.
   * On error: Displays a toast notification with the error message.
   */
  const createMutation = useMutation({
    mutationFn: createTicketType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticketTypes"] });
      toast.success("Ticket type created successfully");
      setIsCreateOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create ticket type");
    },
  });

  /**
   * Mutation for deleting a ticket type.
   * On success: Invalidates the list query and clears the selection.
   */
  const deleteMutation = useMutation({
    mutationFn: deleteTicketType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticketTypes"] });
      toast.success("Ticket type deleted successfully");
      setIsDeleteOpen(false);
      setSelectedId(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete ticket type");
    },
  });

  const parentRef = useRef<HTMLDivElement>(null);

  // Create form state
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [nameError, setNameError] = useState("");

  const handleCreateOpenChange = (open: boolean) => {
    setIsCreateOpen(open);
    if (!open) {
      setCreateForm({ name: "", description: "" });
      setNameError("");
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    
    // Perform a client-side check for duplicate names to provide immediate feedback
    // before making an API call. This is case-insensitive.
    const isDuplicate = ticketTypes.some(
      (t) => t.name.toLowerCase() === createForm.name.trim().toLowerCase()
    );
    if (isDuplicate) {
      setNameError("A ticket type with this name already exists.");
      return;
    }
    setNameError("");

    createMutation.mutate({
      name: createForm.name.trim(),
      description: createForm.description.trim(),
    });
  };

  const handleDeleteConfirm = () => {
    if (selectedId) {
      deleteMutation.mutate(selectedId);
    }
  };


  return (
    <div className="h-full flex flex-col p-8 space-y-6">
      {/* Header and actions */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Ticket Types</h1>
          <p className="text-muted-foreground">
            Manage the categories available for support tickets.
          </p>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ticket types..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            disabled={!selectedId}
            onClick={() => setIsDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>

          <Dialog open={isCreateOpen} onOpenChange={handleCreateOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Ticket Type
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleCreateSubmit}>
                <DialogHeader>
                  <DialogTitle>Add Ticket Type</DialogTitle>
                  <DialogDescription>
                    Create a new category for support tickets. Name must be unique.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={createForm.name}
                      onChange={(e) => {
                        setCreateForm({ ...createForm, name: e.target.value });
                        if (nameError) setNameError("");
                      }}
                      required
                    />
                    {nameError && (
                      <p className="text-sm text-destructive">{nameError}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={createForm.description}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, description: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-md bg-background overflow-hidden">
        <div
          ref={parentRef}
          className="max-h-[445px] overflow-auto relative w-full"
        >
          <table className="w-full caption-bottom text-sm text-left border-collapse">
            <TableHeader className="sticky top-0 z-10 shadow-sm bg-background">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px] bg-background"></TableHead>
                <TableHead className="bg-background">Name</TableHead>
                <TableHead className="bg-background">Description</TableHead>
                <TableHead className="bg-background">Slug</TableHead>
                <TableHead className="bg-background">Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5} className="p-2">
                      <Skeleton className="h-12 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="flex flex-col items-center justify-center h-40 text-destructive gap-2">
                      <AlertCircle className="h-8 w-8" />
                      <p>Failed to load ticket types</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : ticketTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                      <p>No ticket types found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                ticketTypes.map((item) => {
                  const isSelected = selectedId === item._id;

                  return (
                    <TableRow
                      key={item._id}
                      data-state={isSelected ? "selected" : undefined}
                      className="cursor-pointer"
                      onClick={() =>
                        setSelectedId(isSelected ? null : item._id)
                      }
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() =>
                            setSelectedId(isSelected ? null : item._id)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="max-w-[300px] truncate" title={item.description}>
                        {item.description}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.slug}
                      </TableCell>
                      <TableCell>
                        {formatRelativeTime(item.createdAt)}
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
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} entries
            </>
          ) : (
            "Showing 0 to 0 of 0 entries"
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
            disabled={!meta || meta.page <= 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <div className="text-sm font-medium">
            Page {meta?.page || 1} of {meta ? Math.ceil(meta.total / meta.limit) : 1}
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

      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the
              ticket type.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
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
    </div>
  );
}
