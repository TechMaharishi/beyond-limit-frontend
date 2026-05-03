import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Search, Tag as TagIcon, Ban, CheckCircle, MoreHorizontal, AlertTriangle } from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tag {
  _id: string;
  name: string;
  slug: string;
  active: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface TagsResponse {
  success: boolean;
  message: string;
  data: Tag[];
}

// ─── API ──────────────────────────────────────────────────────────────────────

const fetchTags = async () => {
  const response = await apiClient.get<TagsResponse>("/admin/tags");
  return response.data;
};

const createTag = async (name: string) => {
  const response = await apiClient.post("/admin/create-tags", { name });
  return response.data;
};

const deleteTag = async (id: string) => {
  const response = await apiClient.delete(`/admin/tags/${id}`);
  return response.data;
};

const activateTag = async (id: string) => {
  const response = await apiClient.put(`/admin/tags/${id}/activate`);
  return response.data;
};

const deactivateTag = async (id: string) => {
  const response = await apiClient.put(`/admin/tags/${id}/deactivate`);
  return response.data;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VideoTagsPage() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  // track which tag ids have a pending activate/deactivate in flight
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["video-tags"],
    queryFn: fetchTags,
  });

  const tags = data?.data ?? [];

  const filteredTags = tags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(search.toLowerCase()) ||
      tag.slug.toLowerCase().includes(search.toLowerCase())
  );

  const hasSearch = search.length > 0;

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: createTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-tags"] });
      toast.success("Learning area created successfully");
      setIsCreateOpen(false);
      setNewTagName("");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to create learning area");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-tags"] });
      toast.success("Learning area deleted permanently");
      setDeleteTarget(null);
      setSelectedTagId(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to delete learning area");
    },
  });

  const activateMutation = useMutation({
    mutationFn: activateTag,
    onMutate: (id) => setTogglingIds((prev) => new Set(prev).add(id)),
    onSettled: (_, __, id) => setTogglingIds((prev) => { const n = new Set(prev); n.delete(id); return n; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-tags"] });
      toast.success("Learning area activated");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to activate learning area");
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateTag,
    onMutate: (id) => setTogglingIds((prev) => new Set(prev).add(id)),
    onSettled: (_, __, id) => setTogglingIds((prev) => { const n = new Set(prev); n.delete(id); return n; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-tags"] });
      toast.success("Learning area deactivated");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to deactivate learning area");
    },
  });

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleCreate = () => {
    if (!newTagName.trim()) return;
    const exists = tags.some((t) => t.name.toLowerCase() === newTagName.trim().toLowerCase());
    if (exists) {
      toast.error("A learning area with this name already exists");
      return;
    }
    createMutation.mutate(newTagName.trim());
  };

  const handleSelect = (id: string) =>
    setSelectedTagId((prev) => (prev === id ? null : id));

  const openDeleteDialog = (tag: Tag) => setDeleteTarget(tag);

  const handleDelete = () => {
    if (deleteTarget) deleteMutation.mutate(deleteTarget._id);
  };

  return (
    <div className="flex flex-col gap-6 p-8 h-full">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Learning Areas</h1>
        <p className="text-muted-foreground mt-1">
          Organize content by defining key learning areas and topics.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search learning areas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* #10 — toolbar Delete is secondary; deactivate is the preferred soft-action */}
          <Button
            variant="outline"
            className="text-destructive border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
            disabled={!selectedTagId}
            onClick={() => {
              const tag = tags.find((t) => t._id === selectedTagId);
              if (tag) openDeleteDialog(tag);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Learning Area
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Learning Area</DialogTitle>
                <DialogDescription>
                  Add a new learning area to categorize content.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Learning Area Name</Label>
                  <Input
                    id="name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="e.g. Physiotherapy"
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending || !newTagName.trim()}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-background overflow-hidden">
        <div className="max-h-[500px] relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-10 shadow-sm bg-background">
              <TableRow>
                <TableHead className="w-[50px] bg-background" />
                {/* #8 — slug collapsed under name; freed column space given to Status + Created */}
                <TableHead className="bg-background">Name</TableHead>
                <TableHead className="w-[15%] bg-background">Status</TableHead>
                <TableHead className="w-[25%] bg-background">Created At</TableHead>
                <TableHead className="w-[50px] bg-background" />
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
                  <TableCell colSpan={5} className="h-24 text-center text-destructive">
                    Failed to load learning areas. Please try again.
                  </TableCell>
                </TableRow>
              ) : filteredTags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    {/* #7 — differentiate search-no-results from empty state */}
                    <div className="flex h-60 flex-col items-center justify-center gap-2 text-muted-foreground">
                      <TagIcon className="h-10 w-10 opacity-20" />
                      {hasSearch ? (
                        <>
                          <p className="font-medium text-foreground">No learning areas match "{search}"</p>
                          <p className="text-sm">Try a different search term.</p>
                          <Button variant="outline" size="sm" onClick={() => setSearch("")} className="mt-1">
                            Clear search
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-foreground">No learning areas yet</p>
                          <p className="text-sm">Create one to start categorizing content.</p>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTags.map((tag) => {
                  const isToggling = togglingIds.has(tag._id);
                  return (
                    <TableRow
                      key={tag._id}
                      className={`cursor-pointer hover:bg-muted/50 ${selectedTagId === tag._id ? "bg-muted" : ""}`}
                      onClick={() => handleSelect(tag._id)}
                    >
                      <TableCell className="w-[50px]">
                        <Checkbox
                          checked={selectedTagId === tag._id}
                          onCheckedChange={() => handleSelect(tag._id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>

                      {/* #8 — name + slug stacked */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium truncate" title={tag.name}>{tag.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">{tag.slug}</span>
                        </div>
                      </TableCell>

                      <TableCell className="w-[15%]">
                        {tag.active ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-transparent shadow-none">
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-200 border-transparent shadow-none">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="w-[25%] text-muted-foreground">
                        {formatRelativeTime(tag.createdAt)}
                      </TableCell>

                      <TableCell className="w-[50px]">
                        {/* #3 — stopPropagation on trigger so row click doesn't fire */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="sr-only">Open menu</span>
                              {/* #9 — spinner while toggling */}
                              {isToggling
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>

                            {/* #10 — Deactivate is the primary soft action; Delete is destructive and separated */}
                            {tag.active ? (
                              <DropdownMenuItem
                                disabled={isToggling}
                                onClick={(e) => { e.stopPropagation(); deactivateMutation.mutate(tag._id); }}
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Deactivate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                disabled={isToggling}
                                onClick={(e) => { e.stopPropagation(); activateMutation.mutate(tag._id); }}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Activate
                              </DropdownMenuItem>
                            )}

                            {/* #4 — Delete in per-row dropdown */}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => { e.stopPropagation(); openDeleteDialog(tag); }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete permanently
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </table>
        </div>
      </div>

      {/* #1 — Delete confirmation names the tag */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete permanently?
            </DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">"{deleteTarget?.name}"</span> will be permanently removed and cannot be recovered.
              {deleteTarget?.active && (
                <span className="block mt-2 text-amber-600">
                  This tag is currently active. Consider deactivating it instead to preserve historical data.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            {/* #10 — offer deactivate as the safer alternative if tag is active */}
            {deleteTarget?.active && (
              <Button
                variant="outline"
                onClick={() => {
                  deactivateMutation.mutate(deleteTarget._id);
                  setDeleteTarget(null);
                }}
              >
                <Ban className="mr-2 h-4 w-4" />
                Deactivate instead
              </Button>
            )}
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
