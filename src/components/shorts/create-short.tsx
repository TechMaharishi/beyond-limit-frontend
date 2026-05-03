import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTags } from '@/hooks/use-course';
import {
    useCreateShort,
    useUpdateShort,
    useShort,
    useDeleteShortVideo,
    useRetrySubtitles,
} from '@/hooks/use-shorts';
import { uploadShortVideo, getMp4PlaybackUrl } from '@/services/cloudinary.service';
import type { AccessLevel, Visibility, ShortVideoStatus } from '@/services/shorts.service';
import { toast } from 'sonner';
import HlsVideo from '@/components/media/hls-video';
import { SubtitleStatusCard } from '@/components/shorts/subtitle-status-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { formatRelativeTime } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Upload,
    Video,
    X,
    Loader2,
    Play,
    Clock,
    ArrowLeft,
    Save,
    Send,
    CheckCircle,
    AlertCircle,
} from 'lucide-react';

/** State model for the short video form. */
interface ShortFormData {
    title: string;
    description: string;
    tags: string[];
    accessLevel: AccessLevel;
    visibility: Visibility;
    cloudinaryUrl: string;
    cloudinaryId: string;
    thumbnailUrl: string;
    durationSeconds: number;
}

const INITIAL_FORM_DATA: ShortFormData = {
    title: '',
    description: '',
    tags: [],
    accessLevel: 'free',
    visibility: 'all',
    cloudinaryUrl: '',
    cloudinaryId: '',
    thumbnailUrl: '',
    durationSeconds: 0,
};

/** Main short video editor component. Manages form state, video uploads, and persistence. */
export default function CreateShort() {
    const navigate = useNavigate();
    const { rolePath, shortId } = useParams();
    const [currentShortId, setCurrentShortId] = useState<string | undefined>(shortId);
    const isEditMode = Boolean(currentShortId);
    const [formData, setFormData] = useState<ShortFormData>(INITIAL_FORM_DATA);
    const [playbackUrl, setPlaybackUrl] = useState<string>('');
    const sanitizeUrl = (u: string) => (u || '').trim().replace(/^`|`$/g, '');
    useEffect(() => {
        const hls = sanitizeUrl(formData.cloudinaryUrl || '');
        if (hls && hls.includes('.m3u8')) setPlaybackUrl(hls);
        else if (formData.cloudinaryId) setPlaybackUrl(getMp4PlaybackUrl(formData.cloudinaryId));
        else setPlaybackUrl(hls);
    }, [formData.cloudinaryId, formData.cloudinaryUrl]);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isRemoveVideoDialogOpen, setIsRemoveVideoDialogOpen] = useState(false);

    const videoInputRef = useRef<HTMLInputElement | null>(null);

    const { data: tags = [], isLoading: isLoadingTags } = useTags();
    const { data: existingShort } = useShort(currentShortId);
    // Subtitle URL comes from API data; no HEAD fetch required
    const subtitleUrl = existingShort?.subtitles?.find(t => t.default)?.url
        || existingShort?.subtitles?.[0]?.url;
    // Subtitle pipeline status fields
    const subtitleStatus = existingShort?.subtitle_status;

    const createShortMutation = useCreateShort();
    const updateShortMutation = useUpdateShort();
    const deleteShortVideoMutation = useDeleteShortVideo();
    const retrySubtitlesMutation = useRetrySubtitles();

    // Load existing short data in edit mode
    useEffect(() => {
        if (existingShort && currentShortId) {
            setFormData({
                title: existingShort.title || '',
                description: existingShort.description || '',
                tags: existingShort.tags || [],
                accessLevel: existingShort.accessLevel || 'free',
                visibility: existingShort.visibility || 'all',
                cloudinaryUrl: sanitizeUrl(existingShort.cloudinaryUrl || ''),
                cloudinaryId: existingShort.cloudinaryId || '',
                thumbnailUrl: sanitizeUrl(existingShort.thumbnailUrl || ''),
                durationSeconds: existingShort.durationSeconds || 0,
            });
        }
    }, [existingShort, currentShortId]);

    /** Format duration in seconds to a readable string. */
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    /** Handle video file selection and upload. */
    const handleVideoUpload = async (file: File) => {
        setErrors(prev => ({ ...prev, video: '' }));

        if (!file.type.startsWith('video/')) {
            setErrors(prev => ({ ...prev, video: 'Please select a valid video file' }));
            return;
        }

        // 2GB limit
        const maxSize = 2 * 1024 * 1024 * 1024;
        if (file.size > maxSize) {
            setErrors(prev => ({ ...prev, video: 'File size exceeds the 2GB limit' }));
            return;
        }

        setVideoFile(file);
        setIsUploading(true);
        setUploadProgress(0);

        try {
            const result = await uploadShortVideo(file, (progress) => {
                setUploadProgress(progress);
            });

            const videoData = {
                cloudinaryUrl: result.cloudinaryUrl,
                cloudinaryId: result.cloudinaryId,
                thumbnailUrl: result.thumbnailUrl,
                durationSeconds: result.durationSeconds,
            };

            setFormData((prev) => ({
                ...prev,
                ...videoData,
            }));

            // Auto-save to backend
            if (isEditMode && currentShortId) {
                await updateShortMutation.mutateAsync({
                    shortId: currentShortId,
                    data: videoData,
                });
                toast.success('Video uploaded and saved!');
            } else {
                // Create new draft
                const newShort = await createShortMutation.mutateAsync({
                    ...formData,
                    ...videoData,
                    title: formData.title || file.name, // Use filename as fallback title
                    description: formData.description || 'Draft', // Fallback description
                    status: 'draft',
                });
                
                toast.success('Video uploaded and draft created!');
                
                // Keep user on the same page; switch to edit mode without navigation
                setCurrentShortId(newShort._id);
            }
        } catch (error) {
            console.error('Video upload error:', error);
            toast.error('Failed to upload video or save draft. Please try again.');
            setVideoFile(null);
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    /** Remove the uploaded video using atomic backend operation. */
    const handleRemoveVideo = async () => {
        if (!currentShortId) {
            // No persisted short yet; just clear local state
            setVideoFile(null);
            setFormData((prev) => ({
                ...prev,
                cloudinaryUrl: '',
                cloudinaryId: '',
                thumbnailUrl: '',
                durationSeconds: 0,
            }));
            return;
        }

        try {
            await toast.promise(
                deleteShortVideoMutation.mutateAsync(currentShortId),
                {
                    loading: 'Deleting video...',
                    success: 'Video deleted successfully',
                    error: 'Failed to delete video',
                }
            );

            setVideoFile(null);
            setFormData((prev) => ({
                ...prev,
                cloudinaryUrl: '',
                cloudinaryId: '',
                thumbnailUrl: '',
                durationSeconds: 0,
            }));
        } catch (error) {
            console.error('Failed to delete video', error);
        }
    };

    const confirmRemoveVideo = async () => {
        await handleRemoveVideo();
        setIsRemoveVideoDialogOpen(false);
    };

    /** Toggle tag selection. */
    const toggleTag = (slug: string) => {
        const newTags = formData.tags.includes(slug)
            ? formData.tags.filter((t) => t !== slug)
            : [...formData.tags, slug];
        setFormData({ ...formData, tags: newTags });
        
        // Clear error if tags are selected
        if (newTags.length > 0) {
            setErrors(prev => ({ ...prev, tags: '' }));
        }
    };

    /** Validate form before submission. */
    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};
        let isValid = true;

        if (!formData.title.trim()) {
            newErrors.title = 'Title is required';
            isValid = false;
        }
        if (!formData.description.trim()) {
            newErrors.description = 'Description is required';
            isValid = false;
        }
        if (!formData.cloudinaryUrl) {
            newErrors.video = 'Video upload is required';
            isValid = false;
        }
        if (formData.tags.length === 0) {
            newErrors.tags = 'At least one Learning Area is required';
            isValid = false;
        }

        setErrors(newErrors);
        return isValid;
    };

    /** Save as draft. */
    const handleSaveDraft = async () => {
        // No validation for drafts
        setIsSaving(true);
        try {
            if (isEditMode && currentShortId) {
                await updateShortMutation.mutateAsync({
                    shortId: currentShortId,
                    data: { ...formData, status: 'draft' as ShortVideoStatus },
                });
                toast.success('Short video saved as draft!');
            } else {
                await createShortMutation.mutateAsync({
                    ...formData,
                    status: 'draft' as ShortVideoStatus,
                });
                toast.success('Short video created as draft!');
            }
            navigate(rolePath ? `/${rolePath}/content/drafts/shorts` : '/content/drafts/shorts');
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Failed to save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    /** Submit for review (sets status to pending). */
    const handleSubmitForReview = async () => {
        if (!validateForm()) return;

        setIsSubmitting(true);
        try {
            if (isEditMode && currentShortId) {
                await updateShortMutation.mutateAsync({
                    shortId: currentShortId,
                    data: { ...formData, status: 'pending' as ShortVideoStatus },
                });
            } else {
                await createShortMutation.mutateAsync({
                    ...formData,
                    status: 'pending' as ShortVideoStatus,
                });
            }
            toast.success('Short video submitted for review!');
            navigate(rolePath ? `/${rolePath}/content/reviews/shorts` : '/content/reviews/shorts');
        } catch (error) {
            console.error('Submit error:', error);
            toast.error('Failed to submit. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    /** Publish directly (admin only). */
    const handlePublish = async () => {
        if (!validateForm()) return;

        setIsPublishing(true);
        try {
            if (isEditMode && currentShortId) {
                await updateShortMutation.mutateAsync({
                    shortId: currentShortId,
                    data: { ...formData, status: 'published' as ShortVideoStatus },
                });
            } else {
                await createShortMutation.mutateAsync({
                    ...formData,
                    status: 'published' as ShortVideoStatus,
                });
            }
            toast.success('Short video published!');
            navigate(rolePath ? `/${rolePath}/content/shorts` : '/content/shorts');
        } catch (error) {
            console.error('Publish error:', error);
            toast.error('Failed to publish. Please try again.');
        } finally {
            setIsPublishing(false);
        }
    };

    /** Navigate back to shorts list. */
    const handleCancel = () => {
        navigate(rolePath ? `/${rolePath}/content/shorts` : '/content/shorts');
    };

    const isAdmin = rolePath === 'super-admin';
    const isProcessing = isSaving || isSubmitting || isPublishing || isUploading;

    /** Handle subtitle retry */
    const handleRetrySubtitles = () => {
        if (!currentShortId) return;
        retrySubtitlesMutation.mutate(currentShortId, {
            onSuccess: () => toast.success('Subtitle generation queued!'),
            onError: (err: any) =>
                toast.error(err?.response?.data?.message || 'Failed to queue subtitle generation'),
        });
    };
    return (
        <div className="space-y-6 p-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={handleCancel}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {isEditMode ? 'Edit Short Video' : 'Create Short Video'}
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            {isEditMode ? 'Update your short video details' : 'Upload and configure a new short video'}
                        </p>
                    </div>
                </div>
            </div>

            {existingShort?.status === 'rejected' && existingShort?.rejectReason && (
                <Alert variant="destructive" className="shadow-sm bg-gradient-to-r from-destructive/10 to-transparent">
                    <AlertCircle />
                    <AlertTitle>Submission Rejected</AlertTitle>
                    <AlertDescription>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="text-destructive font-medium">Reason:</span>
                                <span className="text-destructive">{existingShort.rejectReason}</span>
                            </div>
                            {existingShort.updatedAt && (
                                <p className="text-xs text-muted-foreground">
                                    Reviewed {formatRelativeTime(existingShort.updatedAt)}
                                </p>
                            )}
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
                {/* Main Content */}
                <div className="space-y-6">
                    {/* Basic Details Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Video Details</CardTitle>
                            <CardDescription>Enter the title and description for your short video</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="title">
                                    Title <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="title"
                                    value={formData.title}
                                    onChange={(e) => {
                                        setFormData({ ...formData, title: e.target.value });
                                        if (e.target.value.trim()) setErrors(prev => ({ ...prev, title: '' }));
                                    }}
                                    placeholder="Enter an engaging title"
                                    className={`h-11 ${errors.title ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                    maxLength={100}
                                />
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-destructive h-4">{errors.title}</span>
                                    <span className="text-muted-foreground">{formData.title.length}</span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">
                                    Description <span className="text-destructive">*</span>
                                </Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => {
                                        setFormData({ ...formData, description: e.target.value });
                                        if (e.target.value.trim()) setErrors(prev => ({ ...prev, description: '' }));
                                    }}
                                    placeholder="Describe what viewers will learn"
                                    className={`min-h-[120px] resize-none ${errors.description ? "border-destructive focus-visible:ring-destructive" : ""}`}
                                    maxLength={500}
                                />
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-destructive h-4">{errors.description}</span>
                                    <span className="text-muted-foreground">{formData.description.length}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Video Upload Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Video Upload <span className="text-destructive">*</span></CardTitle>
                            <CardDescription>Upload your short video file</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {errors.video && (
                                <p className="text-sm text-destructive mb-4">{errors.video}</p>
                            )}
                            {formData.cloudinaryUrl ? (
                                <div className="relative rounded-lg border bg-muted/30 overflow-hidden w-full">
                                    {/* Video Preview - Fixed dimensions */}
                                    <div className="relative w-full h-64 bg-black">
                                        <HlsVideo
                                            hlsUrl={playbackUrl.includes('.m3u8') ? playbackUrl : sanitizeUrl(formData.cloudinaryUrl || '')}
                                            mp4Url={formData.cloudinaryId ? getMp4PlaybackUrl(formData.cloudinaryId) : undefined}
                                            vttUrl={subtitleUrl}
                                        />
                                    </div>
                                    {/* Video Info */}
                                    <div className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 rounded-lg bg-primary/10">
                                                <Video className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium truncate max-w-[200px]">{videoFile?.name || 'Uploaded Video'}</p>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    <span>{formatDuration(formData.durationSeconds)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setIsRemoveVideoDialogOpen(true)}
                                            disabled={isProcessing}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ) : isUploading ? (
                                <div className="rounded-lg border-2 border-dashed border-primary/50 p-8">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="p-4 rounded-full bg-primary/10">
                                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-medium">Uploading video...</p>
                                            <p className="text-sm text-muted-foreground">{uploadProgress}% complete</p>
                                        </div>
                                        <Progress value={uploadProgress} className="w-full max-w-xs" />
                                    </div>
                                </div>
                            ) : (
                                <div
                                    className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 hover:border-primary/50 transition-colors cursor-pointer"
                                    onClick={() => videoInputRef.current?.click()}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const file = e.dataTransfer.files[0];
                                        if (file) handleVideoUpload(file);
                                    }}
                                >
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="p-4 rounded-full bg-muted">
                                            <Upload className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-medium">Click to upload or drag and drop</p>
                                            <p className="text-sm text-muted-foreground">
                                                MP4, MOV, WebM up to 2 GB
                                            </p>
                                        </div>
                                        <Button variant="secondary" type="button">
                                            <Play className="mr-2 h-4 w-4" />
                                            Select Video
                                        </Button>
                                    </div>
                                    <input
                                        ref={videoInputRef}
                                        type="file"
                                        accept="video/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleVideoUpload(file);
                                        }}
                                    />
                                </div>
                            )}
                            <Dialog open={isRemoveVideoDialogOpen} onOpenChange={setIsRemoveVideoDialogOpen}>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Remove Video</DialogTitle>
                                        <DialogDescription>
                                            This will remove the video from this short. This action cannot be undone.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setIsRemoveVideoDialogOpen(false)}
                                            disabled={isProcessing || deleteShortVideoMutation.isPending}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            onClick={confirmRemoveVideo}
                                            disabled={isProcessing || deleteShortVideoMutation.isPending}
                                        >
                                            {deleteShortVideoMutation.isPending && (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            )}
                                            Remove
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Learning Areas Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Learning Areas <span className="text-destructive">*</span></CardTitle>
                            <CardDescription>Select relevant categories for your video</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {errors.tags && (
                                <p className="text-sm text-destructive mb-3">{errors.tags}</p>
                            )}
                            {isLoadingTags ? (
                                <div className="flex flex-wrap gap-2">
                                    {Array.from({ length: 10 }).map((_, i) => (
                                        <Skeleton key={i} className="h-6 w-24 rounded-full" />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {tags.filter(tag => tag.active).map((tag) => (
                                        <Badge
                                            key={tag._id}
                                            variant={formData.tags.includes(tag.slug) ? 'default' : 'outline'}
                                            className="cursor-pointer transition-colors"
                                            onClick={() => toggleTag(tag.slug)}
                                        >
                                            {tag.name}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Settings Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Settings</CardTitle>
                            <CardDescription>Configure access and visibility</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Access Level */}
                            <div className="space-y-3">
                                <Label>Access Level <span className="text-destructive">*</span></Label>
                                <RadioGroup
                                    value={formData.accessLevel}
                                    onValueChange={(value) =>
                                        setFormData({ ...formData, accessLevel: value as AccessLevel })
                                    }
                                    className="space-y-2"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="free" id="access-free" />
                                        <Label htmlFor="access-free" className="font-normal cursor-pointer">
                                            Free
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="develop" id="access-develop" />
                                        <Label htmlFor="access-develop" className="font-normal cursor-pointer">
                                            Develop
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="master" id="access-master" />
                                        <Label htmlFor="access-master" className="font-normal cursor-pointer">
                                            Master
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {/* Visibility */}
                            <div className="space-y-3">
                                <Label>Visibility <span className="text-destructive">*</span></Label>
                                <Select
                                    value={formData.visibility}
                                    onValueChange={(value) =>
                                        setFormData({ ...formData, visibility: value as Visibility })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select visibility" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Users</SelectItem>
                                        <SelectItem value="clinicians">Clinicians Only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Subtitle Status Card — edit mode only */}
                    {isEditMode && currentShortId && (
                        <SubtitleStatusCard
                            shortId={currentShortId}
                            status={subtitleStatus}
                            failureReason={existingShort?.subtitle_failure_reason}
                            retryCount={existingShort?.subtitle_retry_count}
                            lastAttempt={existingShort?.last_subtitle_attempt}
                            retryable={existingShort?.retryable}
                            hasSubtitleUrl={!!subtitleUrl}
                            isRetrying={retrySubtitlesMutation.isPending}
                            onRetry={handleRetrySubtitles}
                        />
                    )}

                    {/* Actions Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Actions</CardTitle>
                            <CardDescription>Save or publish your video</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {/* All roles can save as draft */}
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={handleSaveDraft}
                                disabled={isProcessing}
                            >
                                {isSaving ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="mr-2 h-4 w-4" />
                                )}
                                Save as Draft
                            </Button>

                            {/* Non-admin roles: Submit for Review (sets status to pending) */}
                            {!isAdmin && (
                                <Button
                                    className="w-full"
                                    onClick={handleSubmitForReview}
                                    disabled={isProcessing}
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="mr-2 h-4 w-4" />
                                    )}
                                    Submit for Review
                                </Button>
                            )}

                            {/* Admin only: Publish directly */}
                            {isAdmin && (
                                <Button
                                    className="w-full"
                                    onClick={handlePublish}
                                    disabled={isProcessing}
                                >
                                    {isPublishing ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                    )}
                                    Publish
                                </Button>
                            )}

                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={handleCancel}
                                disabled={isProcessing}
                            >
                                Cancel
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
