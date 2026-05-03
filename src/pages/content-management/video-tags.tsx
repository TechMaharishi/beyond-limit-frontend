import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Search, Tag as TagIcon, Ban, CheckCircle, MoreHorizontal } from "lucide-react";
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
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DropdownMenuLabel } from "@radix-ui/react-dropdown-menu";

/** Types used by video tag management. */

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

/** API helpers for tag retrieval and management. */

/** Fetch all tags for administration. */
const fetchTags = async () => {
  const response = await apiClient.get<TagsResponse>("/admin/tags");
  return response.data;
};

/** Create a new tag with the given name. */
const createTag = async (name: string) => {
  const response = await apiClient.post("/admin/create-tags", { name });
  return response.data;
};

/** Delete a tag by ID. */
const deleteTag = async (id: string) => {
  const response = await apiClient.delete(`/admin/tags/${id}`);
  return response.data;
};

/** Activate a tag. */
const activateTag = async (id: string) => {
  const response = await apiClient.put(`/admin/tags/${id}/activate`);
  return response.data;
};

/** Deactivate a tag. */
const deactivateTag = async (id: string) => {
  const response = await apiClient.put(`/admin/tags/${id}/deactivate`);
  return response.data;
};

export default function VideoTagsPage() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const queryClient = useQueryClient();

  // Fetch Tags
  const { data, isLoading, isError } = useQuery({
    queryKey: ["video-tags"],
    queryFn: fetchTags,
  });

  const tags = data?.data || [];
  
  // Filter tags by name or slug (case-insensitive).
  const filteredTags = tags.filter((tag) => 
    tag.name.toLowerCase().includes(search.toLowerCase()) || 
    tag.slug.toLowerCase().includes(search.toLowerCase())
  );

  // Mutations
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
      toast.success("Learning area deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedTagId(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to delete learning area");
    },
  });

  const activateMutation = useMutation({
    mutationFn: activateTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-tags"] });
      toast.success("Learning area activated successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to activate learning area");
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-tags"] });
      toast.success("Learning area deactivated successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to deactivate learning area");
    },
  });

  // Handlers
  const handleCreate = () => {
    if (!newTagName.trim()) return;
    
    // Prevent duplicates by case-insensitive match against existing tag names.
    const exists = tags.some(t => t.name.toLowerCase() === newTagName.trim().toLowerCase());
    if (exists) {
      toast.error("A learning area with this name already exists");
      return;
    }

    createMutation.mutate(newTagName.trim());
  };

  const handleDeleteClick = () => {
    if (selectedTagId) {
      setIsDeleteDialogOpen(true);
    }
  };

  const handleDelete = () => {
    if (selectedTagId) {
      deleteMutation.mutate(selectedTagId);
    }
  };

  const handleSelect = (id: string) => {
    if (selectedTagId === id) {
      setSelectedTagId(null);
    } else {
      setSelectedTagId(id);
    }
  };

  return (
    <div className="space-y-6 p-8 h-full flex flex-col">
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
            <Button 
                variant="destructive" 
                disabled={!selectedTagId} 
                onClick={handleDeleteClick}
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
                <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label htmlFor="name">Learning Area Name</Label>
                    <Input
                    id="name"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="e.g. Physiotherapy"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
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

      {/* Content */}
      <div className="rounded-md border bg-background overflow-hidden">
        <div className="max-h-[500px] relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-10 shadow-sm bg-background">
              <TableRow>
                <TableHead className="w-[50px] bg-background"></TableHead>
                <TableHead className="w-[25%] bg-background">Name</TableHead>
                <TableHead className="w-[25%] bg-background">Slug</TableHead>
                <TableHead className="w-[15%] bg-background">Status</TableHead>
                <TableHead className="w-[25%] bg-background">Created At</TableHead>
                <TableHead className="w-[50px] bg-background"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="p-2">
                      <Skeleton className="h-12 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-destructive">
                    Failed to load learning areas. Please try again.
                  </TableCell>
                </TableRow>
              ) : filteredTags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-60 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <TagIcon className="h-12 w-12 mb-4 opacity-20" />
                      <h3 className="text-lg font-semibold">No learning areas found</h3>
                      <p>Create a new learning area to get started.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTags.map((tag) => (
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
                    <TableCell className="font-medium max-w-[200px] truncate" title={tag.name}>
                      {tag.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono font-normal">
                        {tag.slug}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {tag.active ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-transparent shadow-none">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-800 hover:bg-slate-200 border-transparent shadow-none">
                          Deactivated
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(tag.createdAt)}
                    </TableCell>
                    <TableCell className="w-[50px]">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          {!tag.active ? (
                            <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                activateMutation.mutate(tag._id);
                            }}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Activate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                deactivateMutation.mutate(tag._id);
                            }}>
                              <Ban className="mr-2 h-4 w-4" />
                              Deactivate
                            </DropdownMenuItem>
                          )}
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

      {/* Delete Confirmation */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => !open && setIsDeleteDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the learning area
              and remove it from our servers.
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
