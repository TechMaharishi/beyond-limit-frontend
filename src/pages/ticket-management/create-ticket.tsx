import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTicketsByType, useCreateTicket, useTicketTypes, useTickets } from '@/hooks/use-support';
import type { CreateTicketPayload } from '@/services/support.service';
import { toast } from 'sonner';
import { cn, formatRelativeTime, getRoleFromPath } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { Upload, X, Plus } from 'lucide-react';

/** State model for the ticket form. */
interface TicketFormData {
    subject: string;
    type: string;
    description: string;
}

const INITIAL_FORM_DATA: TicketFormData = {
    subject: '',
    type: 'app-technical-support',
    description: '',
};

interface FilePreviewItem {
    file: File;
    previewUrl: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_IMAGE_COUNT = 10;
const MAX_VIDEO_COUNT = 3;

/** Admin ticket management page - view app-technical-support tickets and create new ones. */
export default function CreateTicketPage() {
    const { rolePath } = useParams();
    const role = getRoleFromPath(rolePath || '');
    const isAdmin = role === 'admin';
    const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [formData, setFormData] = useState<TicketFormData>(
        isAdmin ? INITIAL_FORM_DATA : { ...INITIAL_FORM_DATA, type: '' }
    );
    const [imageFiles, setImageFiles] = useState<FilePreviewItem[]>([]);
    const [videoFiles, setVideoFiles] = useState<FilePreviewItem[]>([]);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);

    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const videoInputRef = useRef<HTMLInputElement | null>(null);

    const adminQuery = useTicketsByType('app-technical-support', page, limit);
    const userQuery = useTickets(page, limit);
    const ticketData = isAdmin ? adminQuery.data : userQuery.data;
    const isLoadingTickets = isAdmin ? adminQuery.isLoading : userQuery.isLoading;
    const refetch = isAdmin ? adminQuery.refetch : userQuery.refetch;
    const { data: ticketTypes = [], isLoading: isLoadingTypes } = useTicketTypes();
    const tickets = ticketData?.data || [];
    const meta = ticketData?.meta;
    const createTicketMutation = useCreateTicket();

    // Auto-select first ticket
    useEffect(() => {
        if (tickets.length > 0 && !selectedTicketId && !isLoadingTickets) {
            setSelectedTicketId(tickets[0]._id);
        }
    }, [isLoadingTickets, tickets, selectedTicketId]);

    const selectedTicket = tickets.find(t => t._id === selectedTicketId);
    const selectedTicketImageUrls = selectedTicket?.imageUrls?.length
        ? selectedTicket.imageUrls
        : selectedTicket?.imageUrl
            ? [selectedTicket.imageUrl]
            : [];
    const selectedTicketVideoUrls = selectedTicket?.videoUrls || [];

    const revokePreviews = (items: FilePreviewItem[]) => {
        items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };

    const createPreviewItems = (files: File[]) =>
        files.map((file) => ({
            file,
            previewUrl: URL.createObjectURL(file),
        }));

    const validateFiles = (
        files: File[],
        kind: 'image' | 'video',
        existingCount: number,
        maxCount: number
    ) => {
        if (existingCount + files.length > maxCount) {
            toast.error(`You can upload up to ${maxCount} ${kind}${maxCount > 1 ? 's' : ''}.`);
            return false;
        }

        for (const file of files) {
            if (kind === 'image' && !file.type.startsWith('image/')) {
                toast.error('Please select valid image files.');
                return false;
            }
            if (kind === 'video' && !file.type.startsWith('video/')) {
                toast.error('Please select valid video files.');
                return false;
            }
            if (file.size > MAX_FILE_SIZE) {
                toast.error(`${file.name} exceeds the 50 MB limit.`);
                return false;
            }
        }

        return true;
    };

    /** Handle image file selection. */
    const handleImageUpload = (files: FileList | null) => {
        const selectedFiles = Array.from(files || []);
        if (selectedFiles.length === 0) return;
        if (!validateFiles(selectedFiles, 'image', imageFiles.length, MAX_IMAGE_COUNT)) return;

        setImageFiles((prev) => [...prev, ...createPreviewItems(selectedFiles)]);
        if (imageInputRef.current) {
            imageInputRef.current.value = '';
        }
    };

    /** Handle video file selection. */
    const handleVideoUpload = (files: FileList | null) => {
        const selectedFiles = Array.from(files || []);
        if (selectedFiles.length === 0) return;
        if (!validateFiles(selectedFiles, 'video', videoFiles.length, MAX_VIDEO_COUNT)) return;

        setVideoFiles((prev) => [...prev, ...createPreviewItems(selectedFiles)]);
        if (videoInputRef.current) {
            videoInputRef.current.value = '';
        }
    };

    /** Remove uploaded image. */
    const handleRemoveImage = (index: number) => {
        setImageFiles((prev) => {
            const item = prev[index];
            if (item) {
                URL.revokeObjectURL(item.previewUrl);
            }
            return prev.filter((_, i) => i !== index);
        });
        if (imageInputRef.current) {
            imageInputRef.current.value = '';
        }
    };

    /** Remove uploaded video. */
    const handleRemoveVideo = (index: number) => {
        setVideoFiles((prev) => {
            const item = prev[index];
            if (item) {
                URL.revokeObjectURL(item.previewUrl);
            }
            return prev.filter((_, i) => i !== index);
        });
        if (videoInputRef.current) {
            videoInputRef.current.value = '';
        }
    };

    /** Reset form to initial state. */
    const resetForm = () => {
        setFormData(isAdmin ? INITIAL_FORM_DATA : { ...INITIAL_FORM_DATA, type: '' });
        revokePreviews(imageFiles);
        revokePreviews(videoFiles);
        setImageFiles([]);
        setVideoFiles([]);
        if (imageInputRef.current) imageInputRef.current.value = '';
        if (videoInputRef.current) videoInputRef.current.value = '';
    };

    useEffect(() => {
        return () => {
            revokePreviews(imageFiles);
            revokePreviews(videoFiles);
        };
    }, [imageFiles, videoFiles]);

    /** Validate form before submission. */
    const validateForm = (): boolean => {
        if (!formData.subject.trim()) {
            toast.error('Subject is required');
            return false;
        }
        if (!isAdmin && !formData.type) {
            toast.error('Ticket Type is required');
            return false;
        }
        if (!formData.description.trim()) {
            toast.error('Description is required');
            return false;
        }
        return true;
    };

    /** Submit the ticket. */
    const handleSubmit = async () => {
        if (!validateForm()) return;

        try {
            const payload: CreateTicketPayload = {
                subject: formData.subject,
                type: isAdmin ? 'app-technical-support' : formData.type,
                description: formData.description,
                images: imageFiles.map((item) => item.file),
                videos: videoFiles.map((item) => item.file),
            };

            await createTicketMutation.mutateAsync(payload);
            toast.success('Ticket created successfully!');
            setIsDialogOpen(false);
            resetForm();
            refetch();
        } catch (error) {
            console.error('Ticket creation error:', error);
            toast.error('Failed to create ticket. Please try again.');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "pending": return "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20";
            case "resolved": return "bg-green-500/10 text-green-500 hover:bg-green-500/20";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    return (
        <div className="flex h-[calc(100vh-8rem)] w-full bg-background border rounded-lg overflow-hidden shadow-sm">
            {/* Left Sidebar - Ticket List */}
            <div className="w-full md:w-[350px] lg:w-[400px] flex flex-col border-r bg-muted/10">
                <div className="p-4 border-b space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold tracking-tight">App Support</h2>
                    </div>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full">
                                <Plus className="mr-2 h-4 w-4" />
                                Create Ticket
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg md:max-w-xl lg:max-w-2xl max-h-[92vh] sm:max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Create New Support Ticket</DialogTitle>
                                <DialogDescription>
                                    Report technical issues with the application
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                {/* Subject */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">
                                        Subject <span className="text-destructive">*</span>
                                    </label>
                                    <Input
                                        value={formData.subject}
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                        placeholder="Brief summary of your issue"
                                        maxLength={200}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {formData.subject.length}/200 characters
                                    </p>
                                </div>

                        {/* Ticket Type */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Ticket Type</label>
                            {isAdmin ? (
                                <Input
                                    value="App Technical Support"
                                    disabled
                                    className="bg-muted"
                                />
                            ) : (
                                <Select
                                    value={formData.type}
                                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                                    disabled={isLoadingTypes || createTicketMutation.isPending}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select ticket type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ticketTypes
                                            .filter(tt => tt.active)
                                            .map(tt => (
                                                <SelectItem key={tt._id} value={tt.slug}>
                                                    {tt.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                                {/* Description */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">
                                        Description <span className="text-destructive">*</span>
                                    </label>
                                    <Textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Provide detailed information about your issue"
                                        className="min-h-[150px] resize-none"
                                        maxLength={1000}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {formData.description.length}/1000 characters
                                    </p>
                                </div>

                                {/* Attachments */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Attachments (Optional)</label>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div
                                            className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 hover:border-primary/50 transition-colors cursor-pointer bg-muted/5"
                                            onClick={() => imageInputRef.current?.click()}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-muted shrink-0">
                                                    <Upload className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">Upload images</p>
                                                    <p className="text-xs text-muted-foreground">Up to 10 files, 50 MB each</p>
                                                </div>
                                            </div>
                                            <input
                                                ref={imageInputRef}
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                className="hidden"
                                                onChange={(e) => handleImageUpload(e.target.files)}
                                            />
                                        </div>
                                        <div
                                            className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 hover:border-primary/50 transition-colors cursor-pointer bg-muted/5"
                                            onClick={() => videoInputRef.current?.click()}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-muted shrink-0">
                                                    <Upload className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">Upload videos</p>
                                                    <p className="text-xs text-muted-foreground">Up to 3 files, 50 MB each</p>
                                                </div>
                                            </div>
                                            <input
                                                ref={videoInputRef}
                                                type="file"
                                                accept="video/*"
                                                multiple
                                                className="hidden"
                                                onChange={(e) => handleVideoUpload(e.target.files)}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Frontend validation blocks image or video files larger than 50 MB.
                                    </p>
                                    {imageFiles.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium">Images ({imageFiles.length}/{MAX_IMAGE_COUNT})</p>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                {imageFiles.map((item, index) => (
                                                    <div key={`${item.file.name}-${index}`} className="relative rounded-lg border overflow-hidden bg-muted/30">
                                                        <div className="flex items-center gap-3 p-3">
                                                            <img
                                                                src={item.previewUrl}
                                                                alt={item.file.name}
                                                                className="w-16 h-16 object-cover rounded border"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium truncate">{item.file.name}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                                                                </p>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 shrink-0"
                                                                onClick={() => handleRemoveImage(index)}
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {videoFiles.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium">Videos ({videoFiles.length}/{MAX_VIDEO_COUNT})</p>
                                            <div className="space-y-3">
                                                {videoFiles.map((item, index) => (
                                                    <div key={`${item.file.name}-${index}`} className="relative rounded-lg border overflow-hidden bg-muted/30">
                                                        <div className="flex items-center gap-3 p-3">
                                                            <video
                                                                src={item.previewUrl}
                                                                className="w-24 h-16 rounded border bg-black object-cover"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium truncate">{item.file.name}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                                                                </p>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 shrink-0"
                                                                onClick={() => handleRemoveVideo(index)}
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Submit Button */}
                                <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
                                    <Button
                                        variant="outline"
                                        className="w-full sm:w-auto"
                                        onClick={() => {
                                            setIsDialogOpen(false);
                                            resetForm();
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleSubmit}
                                        className="w-full sm:w-auto"
                                        disabled={createTicketMutation.isPending}
                                    >
                                        {createTicketMutation.isPending ? 'Creating...' : 'Create Ticket'}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {isLoadingTickets ? (
                        <div className="p-4 space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-24 bg-muted/50 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            No app technical support tickets found.
                        </div>
                    ) : (
                        tickets.map((ticket) => (
                            <button
                                key={ticket._id}
                                onClick={() => setSelectedTicketId(ticket._id)}
                                className={cn(
                                    "flex flex-col items-start gap-2 p-4 text-left text-sm transition-all hover:bg-accent w-full border-b",
                                    selectedTicketId === ticket._id && "bg-accent"
                                )}
                            >
                                <div className="flex w-full flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{ticket.user.name}</span>
                                            {ticket.currentStatus === 'pending' && (
                                                <span className="flex h-2 w-2 rounded-full bg-blue-600" />
                                            )}
                                        </div>
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            {formatRelativeTime(ticket.updatedAt)}
                                        </span>
                                    </div>
                                    <span className="font-medium line-clamp-1">
                                        {ticket.subject}
                                    </span>
                                    <span className="line-clamp-2 text-xs text-muted-foreground">
                                        {ticket.description}
                                    </span>
                                    <div className="flex items-center gap-2 mt-2">
                                        <Badge variant="outline" className={cn("text-[10px] px-1 py-0 border-0", getStatusColor(ticket.currentStatus))}>
                                            {ticket.currentStatus}
                                        </Badge>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
                {/* Fixed pagination footer (outside scroll container) */}
                <div className="p-2 border-t flex items-center justify-between">
                    <div className="flex items-center space-x-2 mr-4">
                        <span className="text-xs text-muted-foreground">Rows per page</span>
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
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={(meta?.page || 1) <= 1 || isLoadingTickets}
                    >
                        Previous
                    </Button>
                    <div className="text-xs font-medium">
                        Page {meta?.page || 1}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={!meta?.hasNext || isLoadingTickets}
                    >
                        Next
                    </Button>
                </div>
            </div>

            {/* Right Panel - Ticket Details (Read-only) */}
            {isLoadingTickets || (tickets.length > 0 && !selectedTicketId) ? (
                <div className="flex flex-1 flex-col overflow-hidden bg-background">
                    <div className="flex items-center justify-between p-4 border-b h-[60px]">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                            <div className="space-y-2">
                                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 p-4 space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="h-8 w-1/2 bg-muted animate-pulse rounded" />
                                <div className="h-6 w-20 bg-muted animate-pulse rounded" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="h-4 w-full bg-muted animate-pulse rounded" />
                                <div className="h-4 w-full bg-muted animate-pulse rounded" />
                                <div className="h-4 w-full bg-muted animate-pulse rounded" />
                                <div className="h-4 w-full bg-muted animate-pulse rounded" />
                            </div>
                            <div className="h-40 w-full bg-muted animate-pulse rounded" />
                        </div>
                    </div>
                </div>
            ) : selectedTicket ? (
                <div className="flex flex-1 flex-col overflow-hidden bg-background">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b h-[60px]">
                        <div className="flex items-center gap-4">
                            <Avatar>
                                <AvatarFallback>{selectedTicket.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="font-semibold">{selectedTicket.user.name}</div>
                                <div className="text-xs text-muted-foreground">{selectedTicket.user.email}</div>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-start justify-between">
                                <h1 className="text-2xl font-bold">{selectedTicket.subject}</h1>
                                <Badge variant="outline" className="text-sm">
                                    {formatRelativeTime(selectedTicket.createdAt)}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                                <div>
                                    <span className="font-medium text-foreground">Ticket ID:</span> {selectedTicket._id}
                                </div>
                                <div>
                                    <span className="font-medium text-foreground">Type:</span> {selectedTicket.type}
                                </div>
                                <div>
                                    <span className="font-medium text-foreground">Status:</span>{' '}
                                    <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", getStatusColor(selectedTicket.currentStatus))}>
                                        {selectedTicket.currentStatus}
                                    </span>
                                </div>
                                {selectedTicket.resolvedAt && (
                                    <div>
                                        <span className="font-medium text-foreground">Resolved At:</span> {formatRelativeTime(selectedTicket.resolvedAt)}
                                    </div>
                                )}
                            </div>

                            <div className="prose prose-sm max-w-none text-foreground bg-muted/30 p-4 rounded-md">
                                <h3 className="text-sm font-semibold mb-2">Description</h3>
                                <p>{selectedTicket.description}</p>
                            </div>

                            {selectedTicket.resolutionMsg && (
                                <div className="bg-green-50 border border-green-100 p-4 rounded-md">
                                    <h3 className="text-sm font-semibold text-green-800 mb-1">Resolution</h3>
                                    <p className="text-green-700 text-sm">{selectedTicket.resolutionMsg}</p>
                                </div>
                            )}

                            {(selectedTicketImageUrls.length > 0 || selectedTicketVideoUrls.length > 0) && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium">Attachments</h4>
                                    <div className="flex flex-wrap gap-4">
                                        {selectedTicketImageUrls.map((url, index) => (
                                            <div key={`image-${index}`} className="relative group overflow-hidden rounded-md border bg-muted">
                                                <img
                                                    src={url}
                                                    alt={`Attachment ${index + 1}`}
                                                    className="h-48 w-auto object-cover transition-transform group-hover:scale-105"
                                                />
                                            </div>
                                        ))}
                                        {selectedTicketVideoUrls.map((url, index) => (
                                            <div key={`video-${index}`} className="relative overflow-hidden rounded-md border bg-muted">
                                                <video
                                                    src={url}
                                                    controls
                                                    className="h-48 w-auto max-w-full bg-black"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer - No reply option */}
                    <div className="p-4 bg-background border-t">
                        <div className="flex items-center justify-center p-4 bg-muted/20 rounded-lg border border-dashed">
                            <p className="text-muted-foreground text-sm">
                                View only - replies are not available for this ticket type
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-1 items-center justify-center bg-muted/5 text-muted-foreground">
                    <div className="text-center space-y-2">
                        <div className="text-4xl">🎫</div>
                        {tickets.length === 0 ? (
                            <>
                                <h3 className="font-semibold text-lg">No ticket available</h3>
                                <p className="text-sm">Create a new ticket to get started</p>
                            </>
                        ) : (
                            <>
                                <h3 className="font-semibold text-lg">No ticket selected</h3>
                                <p className="text-sm">Select a ticket from the list to view details</p>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
