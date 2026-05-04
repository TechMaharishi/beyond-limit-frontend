import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTags } from '@/hooks/use-course';
import {
    useCreateShortShell,
    useGetSignedUploadUrl,
    usePollUploadStatus,
    usePublishShort,
    useUpdateShort,
    useShort,
    useDeleteShortVideo,
    useRetrySubtitles,
    useChangeShortStatus,
    useAddShortResource,
    useRemoveShortResource,
} from '@/hooks/use-shorts';
import { getMp4PlaybackUrl } from '@/services/cloudinary.service';
import type { AccessLevel, Visibility } from '@/services/shorts.service';
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
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    XCircle,
    FileText,
    Link,
    Plus,
    Paperclip,
    ExternalLink,
    Trash2,
    Cloud,
    CloudOff,
} from 'lucide-react';

/** State model for the short video form. */
interface ShortFormData {
    title: string;
    description: string;
    tags: string[];
    accessLevel: AccessLevel;
    visibility: Visibility;
    // These are populated after the Cloudinary webhook fires (videoReady: true)
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
    // Ref to track the latest ID to prevent race conditions during debounced auto-saves
    const currentShortIdRef = useRef<string | undefined>(shortId);
    useEffect(() => { currentShortIdRef.current = currentShortId; }, [currentShortId]);

    // isEditMode is true only when the route already had a shortId — stays false during create flow
    // even after auto-save creates a shell and sets currentShortId
    const isEditMode = Boolean(shortId);
    const [formData, setFormData] = useState<ShortFormData>(INITIAL_FORM_DATA);
    const [playbackUrl, setPlaybackUrl] = useState<string>('');
    const sanitizeUrl = (u: string) => (u || '').trim().replace(/^`|`$/g, '');
    // Track whether we are in the polling phase (waiting for Cloudinary webhook)
    const [isPolling, setIsPolling] = useState(false);
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
    const { data: existingShort, refetch: refetchShort } = useShort(currentShortId);
    // Subtitle URL comes from API data; no HEAD fetch required
    const subtitleUrl = existingShort?.subtitles?.find(t => t.default)?.url
        || existingShort?.subtitles?.[0]?.url;
    // Subtitle pipeline status fields
    const subtitleStatus = existingShort?.subtitle_status;

    // V1 two-phase upload hooks
    const createShortShellMutation = useCreateShortShell();
    const getSignedUploadUrlMutation = useGetSignedUploadUrl();
    const publishShortMutation = usePublishShort();
    const changeStatusMutation = useChangeShortStatus();

    // Polling: check if the Cloudinary webhook has finished processing
    const { data: uploadStatus } = usePollUploadStatus(currentShortId, isPolling);

    useEffect(() => {
        if (isPolling && uploadStatus?.videoReady) {
            setIsPolling(false);
            refetchShort();
            toast.success('Video processed successfully!');
        }
    }, [isPolling, uploadStatus?.videoReady, refetchShort]);

    const updateShortMutation = useUpdateShort();
    const deleteShortVideoMutation = useDeleteShortVideo();
    const retrySubtitlesMutation = useRetrySubtitles();

    // Populate the form exactly once per short (guards against auto-save refetches
    // overwriting in-progress edits). Resets when navigating to a different short.
    const isInitialLoad = useRef(true);
    const hasLoadedInitialData = useRef(false);
    useEffect(() => {
        if (existingShort && currentShortId) {
            if (hasLoadedInitialData.current) return;
            hasLoadedInitialData.current = true;
            isInitialLoad.current = true;
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
            setTimeout(() => { isInitialLoad.current = false; }, 0);
        } else if (!currentShortId) {
            hasLoadedInitialData.current = false;
            isInitialLoad.current = false;
        }
    }, [existingShort, currentShortId]);

    // When cloudinaryId changes server-side (new upload processed or video removed),
    // sync only the video fields — never touch the user's text edits.
    const prevCloudinaryIdRef = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (!hasLoadedInitialData.current) return; // initial load handles this
        const newId = existingShort?.cloudinaryId ?? '';
        if (newId === prevCloudinaryIdRef.current) return;
        prevCloudinaryIdRef.current = newId;
        setFormData(prev => ({
            ...prev,
            cloudinaryId: newId,
            cloudinaryUrl: sanitizeUrl(existingShort?.cloudinaryUrl || ''),
            thumbnailUrl: sanitizeUrl(existingShort?.thumbnailUrl || ''),
            durationSeconds: existingShort?.durationSeconds || 0,
        }));
    }, [existingShort?.cloudinaryId, existingShort?.cloudinaryUrl, existingShort?.thumbnailUrl, existingShort?.durationSeconds]);

    // ─── Auto-save state ───────────────────────────────────────────────────────
    type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
    const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savedBadgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cancelAutoSave = useCallback(() => {
        cancelAutoSave();
    }, []);

    const performAutoSave = useCallback(async (data: ShortFormData, shellId?: string) => {
        // Both title and description are required to create a shell — don't attempt until both are present
        if (!shellId && (!data.title.trim() || !data.description.trim())) return;

        setAutoSaveStatus('saving');
        try {
            if (!shellId) {
                // Phase 1: create shell with whatever the user has filled so far
                const shell = await createShortShellMutation.mutateAsync({
                    title: data.title.trim(),
                    description: data.description.trim() || '',
                    tags: data.tags.length > 0 ? data.tags : undefined,
                    accessLevel: data.accessLevel,
                    visibility: data.visibility,
                });
                setCurrentShortId(shell._id);
            } else {
                // Update existing shell/draft metadata
                await updateShortMutation.mutateAsync({
                    shortId: shellId,
                    data: {
                        title: data.title,
                        description: data.description,
                        tags: data.tags,
                        accessLevel: data.accessLevel,
                        visibility: data.visibility,
                    },
                });
            }
            setAutoSaveStatus('saved');
            // Reset badge to 'idle' after 3 seconds
            if (savedBadgeTimer.current) clearTimeout(savedBadgeTimer.current);
            savedBadgeTimer.current = setTimeout(() => setAutoSaveStatus('idle'), 3000);
        } catch {
            setAutoSaveStatus('error');
            if (savedBadgeTimer.current) clearTimeout(savedBadgeTimer.current);
            savedBadgeTimer.current = setTimeout(() => setAutoSaveStatus('idle'), 4000);
        }
    }, [createShortShellMutation, updateShortMutation]);

    /**
     * Debounced auto-save effect.
     * Watches every formData change. Text-field changes (title/description) are debounced
     * by 1.5 s; selection changes (tags, accessLevel, visibility) fire after 300 ms
     * so the UI stays responsive without hammering the API.
     *
     * Guards:
     *  - isInitialLoad.current  → skip the first render after data is loaded from the API
     *  - isUploading / isPolling → skip during video upload phases
     *  - existingShort?.status === 'published' → don't auto-save; track unsaved changes instead
     */
    useEffect(() => {
        if (isInitialLoad.current) return;
        if (isUploading || isPolling) return;

        // Published videos are not auto-saved — mark as unsaved so the UI warns the user
        if (existingShort?.status === 'published') {
            setHasUnsavedChanges(true);
            return;
        }

        setHasUnsavedChanges(false);

        const snapshot = formData;

        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => {
            performAutoSave(snapshot, currentShortIdRef.current);
        }, 1500);

        return cancelAutoSave;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.title, formData.description, formData.tags, formData.accessLevel, formData.visibility]);

    /** Format duration in seconds to a readable string. */
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    /**
     * V1 Two-phase upload flow:
     * 1. Ensure a shell exists (create one if not in edit mode)
     * 2. Get signed upload URL from our backend
     * 3. Upload directly from the browser to Cloudinary using the signed params
     * 4. Start polling GET /v1/short-videos/:id/status until videoReady === true
     */    const addResourceMutation = useAddShortResource();
    const removeResourceMutation = useRemoveShortResource();

    // ─── Resource form state ─────────────────────────────────────────────────
    const [resourceTab, setResourceTab] = useState<'file' | 'url'>('file');
    const [fileResourceName, setFileResourceName] = useState('');
    const [urlResourceName, setUrlResourceName] = useState('');
    const [resourceUrl, setResourceUrl] = useState('');
    const [resourceFile, setResourceFile] = useState<File | null>(null);
    const resourceFileRef = useRef<HTMLInputElement | null>(null);

    const handleAddFileResource = async () => {
        if (!currentShortId) return;
        if (!resourceFile) { toast.error('Please select a file'); return; }
        const name = fileResourceName || resourceFile.name;
        try {
            await addResourceMutation.mutateAsync({
                shortId: currentShortId,
                payload: { type: 'file', name, file: resourceFile },
            });
            setResourceFile(null);
            setFileResourceName('');
            if (resourceFileRef.current) resourceFileRef.current.value = '';
            toast.success('Resource added!');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to add resource');
        }
    };

    const handleAddUrlResource = async () => {
        if (!currentShortId) return;
        if (!urlResourceName.trim()) { toast.error('Please enter a name'); return; }
        if (!resourceUrl.trim() || !resourceUrl.startsWith('http')) {
            toast.error('Please enter a valid URL starting with http(s)://');
            return;
        }
        try {
            await addResourceMutation.mutateAsync({
                shortId: currentShortId,
                payload: { type: 'url', name: urlResourceName.trim(), url: resourceUrl.trim() },
            });
            setUrlResourceName('');
            setResourceUrl('');
            toast.success('Resource added!');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to add resource');
        }
    };

    const handleRemoveResource = async (resourceId: string) => {
        if (!currentShortId) return;
        try {
            await removeResourceMutation.mutateAsync({ shortId: currentShortId, resourceId });
            toast.success('Resource removed');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to remove resource');
        }
    };

    const handleVideoUpload = useCallback(async (file: File) => {
        setErrors(prev => ({ ...prev, video: '' }));

        if (!file.type.startsWith('video/')) {
            setErrors(prev => ({ ...prev, video: 'Please select a valid video file' }));
            return;
        }

        // 2 GB limit
        const maxSize = 2 * 1024 * 1024 * 1024;
        if (file.size > maxSize) {
            setErrors(prev => ({ ...prev, video: 'File size exceeds the 2GB limit' }));
            return;
        }

        // Cancel any pending auto-save to prevent a race with the upload's own shell creation
        cancelAutoSave();
        setVideoFile(file);
        setIsUploading(true);
        setUploadProgress(0);

        try {
            // Phase 1 — ensure a shell exists
            let shellId = currentShortIdRef.current;
            if (!shellId) {
                const shell = await createShortShellMutation.mutateAsync({
                    title: formData.title.trim() || file.name,
                    description: formData.description.trim() || 'Draft short video',
                    tags: formData.tags.length > 0 ? formData.tags : undefined,
                    accessLevel: formData.accessLevel,
                    visibility: formData.visibility,
                });
                shellId = shell._id;
                setCurrentShortId(shellId);
            }

            // Phase 2 — get signed upload params from our backend
            const signedData = await getSignedUploadUrlMutation.mutateAsync(shellId);

            // Phase 3 — upload directly from the browser to Cloudinary
            const formPayload = new FormData();
            formPayload.append('file', file);
            Object.entries(signedData.fields).forEach(([key, val]) => {
                formPayload.append(key, String(val));
            });

            // Use XMLHttpRequest so we can track progress
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', signedData.uploadUrl, true);
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        setUploadProgress(Math.round((e.loaded / e.total) * 100));
                    }
                };
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) resolve();
                    else reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
                };
                xhr.onerror = () => reject(new Error('Network error during upload'));
                xhr.send(formPayload);
            });

            // Phase 4 — start polling; the Cloudinary webhook will update the record
            setIsUploading(false);
            setIsPolling(true);
            toast.info('Video uploaded — waiting for processing...');
        } catch (error) {
            console.error('Video upload error:', error);
            toast.error('Failed to upload video. Please try again.');
            setVideoFile(null);
            setIsUploading(false);
            setUploadProgress(0);
        }
    }, [currentShortId, formData, createShortShellMutation, getSignedUploadUrlMutation]);

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
            // Stop any active upload polling before removing — prevents a stale poll from
            // refetching after the new upload starts and overwriting new video state.
            setIsPolling(false);

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
        // Accept the video if it's already processed (cloudinaryUrl set) or currently uploading/polling
        if (!formData.cloudinaryUrl && !isUploading && !isPolling) {
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

    /**
     * Save metadata as draft.
     *
     * - If no shell exists yet, create one (POST /v1/short-videos).
     * - If shell already exists, update metadata (PUT /short-videos/:id).
     */
    const handleSaveDraft = async () => {
        // Cancel any pending debounced auto-save to prevent a double-create race
        cancelAutoSave();
        setIsSaving(true);
        try {
            if (currentShortId) {
                // Update existing shell/draft metadata
                await updateShortMutation.mutateAsync({
                    shortId: currentShortId,
                    data: {
                        title: formData.title,
                        description: formData.description,
                        tags: formData.tags,
                        accessLevel: formData.accessLevel,
                        visibility: formData.visibility,
                    },
                });
                // If the video is currently published, move it back to draft
                if (existingShort?.status === 'published') {
                    await changeStatusMutation.mutateAsync({
                        shortId: currentShortId,
                        payload: { status: 'draft' },
                    });
                }
                setHasUnsavedChanges(false);
                toast.success('Short video saved as draft!');
            } else {
                // Create a new shell (Phase 1 of V1 flow)
                const shell = await createShortShellMutation.mutateAsync({
                    title: formData.title || 'Untitled Draft',
                    description: formData.description || 'Draft',
                    tags: formData.tags.length > 0 ? formData.tags : undefined,
                    accessLevel: formData.accessLevel,
                    visibility: formData.visibility,
                });
                setCurrentShortId(shell._id);
                toast.success('Draft created!');
            }
            navigate(rolePath ? `/${rolePath}/content/drafts/shorts` : '/content/drafts/shorts');
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Failed to save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Submit for review — sets status to 'pending'.
     *
     * Training Admin (trainer) and Clinical Learner (trainee) use this action.
     * They cannot publish directly; the short goes to the Super Admin for review.
     */
    const handleSubmitForReview = async () => {
        if (!validateForm()) return;
        cancelAutoSave();
        setIsSubmitting(true);
        try {
            // Ensure a shell exists before changing status
            let shellId = currentShortId;
            if (!shellId) {
                const shell = await createShortShellMutation.mutateAsync({
                    title: formData.title,
                    description: formData.description,
                    tags: formData.tags,
                    accessLevel: formData.accessLevel,
                    visibility: formData.visibility,
                });
                shellId = shell._id;
                setCurrentShortId(shellId);
            } else {
                // Save latest metadata first
                await updateShortMutation.mutateAsync({
                    shortId: shellId,
                    data: {
                        title: formData.title,
                        description: formData.description,
                        tags: formData.tags,
                        accessLevel: formData.accessLevel,
                        visibility: formData.visibility,
                    },
                });
            }

            // Use change-status endpoint (trainer/trainee can only set pending)
            await changeStatusMutation.mutateAsync({
                shortId: shellId,
                payload: { status: 'pending' },
            });

            toast.success('Short video submitted for review!');
            navigate(rolePath ? `/${rolePath}/content/reviews/shorts` : '/content/reviews/shorts');
        } catch (error) {
            console.error('Submit error:', error);
            toast.error('Failed to submit. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Publish directly (Super Admin only).
     *
     * Uses POST /v1/short-videos/:id/publish which requires:
     * - cloudinaryId set (video uploaded)
     * - title, description, ≥1 tag
     *
     * If no shell exists yet, create one first then publish.
     */
    const handlePublish = async () => {
        if (!validateForm()) return;
        cancelAutoSave();
        setIsPublishing(true);
        try {
            let shellId = currentShortId;
            if (!shellId) {
                const shell = await createShortShellMutation.mutateAsync({
                    title: formData.title,
                    description: formData.description,
                    tags: formData.tags,
                    accessLevel: formData.accessLevel,
                    visibility: formData.visibility,
                });
                shellId = shell._id;
                setCurrentShortId(shellId);
            } else {
                // Save latest metadata before publishing
                await updateShortMutation.mutateAsync({
                    shortId: shellId,
                    data: {
                        title: formData.title,
                        description: formData.description,
                        tags: formData.tags,
                        accessLevel: formData.accessLevel,
                        visibility: formData.visibility,
                    },
                });
            }

            // If already published, metadata was updated above — no need to re-publish.
            // POST /v1/.../publish rejects with 400 when status is already 'published'.
            if (existingShort?.status !== 'published') {
                await publishShortMutation.mutateAsync(shellId);
            }
            setHasUnsavedChanges(false);
            toast.success(existingShort?.status === 'published' ? 'Published short updated!' : 'Short video published!');
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
    const [rejectReason, setRejectReason] = useState('');
    const [isRejecting, setIsRejecting] = useState(false);

    const handleReject = async () => {
        if (!currentShortId) return;
        if (!rejectReason.trim()) {
            toast.error('Please enter a rejection reason');
            return;
        }
        cancelAutoSave();
        setIsRejecting(true);
        try {
            await changeStatusMutation.mutateAsync({
                shortId: currentShortId,
                payload: { status: 'rejected', rejectReason: rejectReason.trim() },
            });
            toast.success('Short video rejected');
            navigate(rolePath ? `/${rolePath}/content/reviews/shorts` : '/content/reviews/shorts');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to reject. Please try again.');
        } finally {
            setIsRejecting(false);
        }
    };

    const isProcessing = isSaving || isSubmitting || isPublishing || isUploading || isPolling || isRejecting || autoSaveStatus === 'saving';

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

                {/* Auto-save status badge */}
                <div className="flex items-center gap-2 min-h-[28px]">
                    {autoSaveStatus === 'saving' && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-in fade-in">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Saving…
                        </span>
                    )}
                    {autoSaveStatus === 'saved' && (
                        <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                            <Cloud className="h-3.5 w-3.5" />
                            Saved
                        </span>
                    )}
                    {autoSaveStatus === 'error' && (
                        <span className="flex items-center gap-1.5 text-xs text-destructive animate-in fade-in">
                            <CloudOff className="h-3.5 w-3.5" />
                            Save failed
                        </span>
                    )}
                    {hasUnsavedChanges && autoSaveStatus === 'idle' && (
                        <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 animate-in fade-in">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Unsaved changes
                        </span>
                    )}
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
                            ) : isPolling ? (
                                <div className="rounded-lg border-2 border-dashed border-primary/30 p-8">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="p-4 rounded-full bg-primary/10">
                                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-medium">Processing video...</p>
                                            <p className="text-sm text-muted-foreground">
                                                Cloudinary is transcoding your video. This may take a few moments.
                                            </p>
                                        </div>
                                        <Progress value={undefined} className="w-full max-w-xs animate-pulse" />
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

                    {/* Subtitle Status Card — only after a video has been uploaded */}
                    {currentShortId && !!existingShort?.cloudinaryId && (
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
                            isAdmin={isAdmin}
                        />
                    )}

                    {/* ── Resources Card ──────────────────────────────────── */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Paperclip className="h-4 w-4" />
                                Resources
                            </CardTitle>
                            <CardDescription>
                                Attach supplementary files or links (max 10)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            {/* Existing resources list */}
                            {existingShort?.resources && existingShort.resources.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {existingShort.resources.map((res) => (
                                        <div
                                            key={res._id}
                                            className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate">{res.name}</p>
                                                    <a
                                                        href={res.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-xs text-primary hover:underline truncate"
                                                    >
                                                        <ExternalLink className="h-3 w-3 shrink-0" />
                                                        <span className="truncate">{res.url}</span>
                                                    </a>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="shrink-0 size-7 text-destructive hover:text-destructive"
                                                disabled={removeResourceMutation.isPending}
                                                onClick={() => handleRemoveResource(res._id)}
                                            >
                                                {removeResourceMutation.isPending ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-3 w-3" />
                                                )}
                                            </Button>
                                        </div>
                                    ))}
                                    <Separator />
                                </div>
                            ) : existingShort?.resources?.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-2">
                                    No resources attached yet.
                                </p>
                            ) : null}

                            {/* Add resource — locked until a shell exists */}
                            {!currentShortId ? (
                                <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-center">
                                    <Paperclip className="h-5 w-5 mx-auto mb-1 text-muted-foreground/50" />
                                    <p className="text-xs text-muted-foreground">
                                        Save a draft first to attach resources
                                    </p>
                                </div>
                            ) : (
                                <Tabs
                                    value={resourceTab}
                                    onValueChange={(v) => setResourceTab(v as 'file' | 'url')}
                                >
                                    <TabsList className="w-full">
                                        <TabsTrigger value="file" className="flex-1 gap-1.5">
                                            <FileText className="h-3.5 w-3.5" />
                                            Upload File
                                        </TabsTrigger>
                                        <TabsTrigger value="url" className="flex-1 gap-1.5">
                                            <Link className="h-3.5 w-3.5" />
                                            Add Link
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* ─ File upload tab ─────────────────── */}
                                    <TabsContent value="file" className="flex flex-col gap-3 mt-3">
                                        <div
                                            className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 cursor-pointer hover:border-primary/50 transition-colors"
                                            onClick={() => resourceFileRef.current?.click()}
                                        >
                                            <Upload className="h-5 w-5 text-muted-foreground" />
                                            {resourceFile ? (
                                                <div className="text-center">
                                                    <p className="text-sm font-medium truncate max-w-[200px]">{resourceFile.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {(resourceFile.size / 1024).toFixed(1)} KB
                                                    </p>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground text-center">
                                                    Click to select a PDF, DOC, image, or other file
                                                </p>
                                            )}
                                        </div>
                                        <input
                                            ref={resourceFileRef}
                                            type="file"
                                            className="hidden"
                                            onChange={(e) => setResourceFile(e.target.files?.[0] ?? null)}
                                        />
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="resource-file-name" className="text-xs">
                                                Display name <span className="text-muted-foreground">(optional)</span>
                                            </Label>
                                            <Input
                                                id="resource-file-name"
                                                value={fileResourceName}
                                                onChange={(e) => setFileResourceName(e.target.value)}
                                                placeholder={resourceFile?.name ?? 'e.g. Lecture Notes'}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <Button
                                            size="sm"
                                            className="w-full gap-1.5"
                                            onClick={handleAddFileResource}
                                            disabled={!resourceFile || addResourceMutation.isPending}
                                        >
                                            {addResourceMutation.isPending ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Plus className="h-3.5 w-3.5" />
                                            )}
                                            Attach File
                                        </Button>
                                    </TabsContent>

                                    {/* ─ URL link tab ────────────────────── */}
                                    <TabsContent value="url" className="flex flex-col gap-3 mt-3">
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="resource-url-name" className="text-xs">
                                                Name <span className="text-destructive">*</span>
                                            </Label>
                                            <Input
                                                id="resource-url-name"
                                                value={urlResourceName}
                                                onChange={(e) => setUrlResourceName(e.target.value)}
                                                placeholder="e.g. Reference Article"
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor="resource-url" className="text-xs">
                                                URL <span className="text-destructive">*</span>
                                            </Label>
                                            <Input
                                                id="resource-url"
                                                type="url"
                                                value={resourceUrl}
                                                onChange={(e) => setResourceUrl(e.target.value)}
                                                placeholder="https://example.com"
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <Button
                                            size="sm"
                                            className="w-full gap-1.5"
                                            onClick={handleAddUrlResource}
                                            disabled={addResourceMutation.isPending}
                                        >
                                            {addResourceMutation.isPending ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Link className="h-3.5 w-3.5" />
                                            )}
                                            Add Link
                                        </Button>
                                    </TabsContent>
                                </Tabs>
                            )}
                        </CardContent>
                    </Card>


                    {/* Actions Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Actions</CardTitle>
                            <CardDescription>
                                {existingShort?.status === 'published'
                                    ? 'Save changes or move back to draft'
                                    : 'Save or publish your video'}
                            </CardDescription>
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

                            {/* Admin only: Publish / update published */}
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
                                    {existingShort?.status === 'published' ? 'Update Published' : 'Publish'}
                                </Button>
                            )}

                            {/* Admin only: Reject — only shown for pending submissions */}
                            {isAdmin && existingShort?.status === 'pending' && (
                                <>
                                    <Separator />
                                    <div className="space-y-2">
                                        <Label htmlFor="reject-reason" className="text-sm font-medium text-destructive">
                                            Rejection Reason <span className="text-destructive">*</span>
                                        </Label>
                                        <Textarea
                                            id="reject-reason"
                                            value={rejectReason}
                                            onChange={(e) => setRejectReason(e.target.value)}
                                            placeholder="Explain why this video is being rejected…"
                                            className="min-h-[80px] resize-none text-sm"
                                            disabled={isProcessing}
                                        />
                                    </div>
                                    <Button
                                        variant="destructive"
                                        className="w-full"
                                        onClick={handleReject}
                                        disabled={isProcessing || !rejectReason.trim()}
                                    >
                                        {isRejecting ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <XCircle className="mr-2 h-4 w-4" />
                                        )}
                                        Reject Submission
                                    </Button>
                                </>
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
