import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateCourse,
  useUpdateCourse,
  useChangeStatus,
  useUploadResources,
  useDeleteResource,
  useTags,
  useCourse,
  useAddChapter,
  useDeleteChapter,
  useAddLesson,
  useDeleteLesson,
  useAddQuiz,
  useUpdateQuiz,
  useDeleteQuiz,
  useDeleteLessonVideo,
  useRetryCourseSubtitles,
  useGetCourseSignedUploadUrl,
  usePollCourseVideoStatus,
  courseKeys,
} from '@/hooks/use-course';
import { SubtitleStatusCard } from '@/components/shorts/subtitle-status-card';
import { getMp4PlaybackUrl } from '@/services/cloudinary.service';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  Upload,
  Image as ImageIcon,
  Video,
  FileText,
  ChevronRight,
  ChevronLeft,
  Save,
  X,
  CheckCircle2,
  BookOpen,
  Layers,
  Paperclip,
  Settings,
  Eye,
  GripVertical,
  Play,
  Clock,
  Loader2,
  ExternalLink,
} from 'lucide-react';

/** Schema for video assets. */
type VideoSubtitle = {
  lang: string;
  label: string;
  url: string;
  format: 'vtt' | 'srt';
  default?: boolean;
};

type VideoItem = {
  cloudinaryUrl?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  cloudinaryId?: string;
  subtitle_status?: 'pending' | 'processing' | 'completed' | 'failed';
  subtitle_failure_reason?: string | null;
  subtitle_retry_count?: number;
  last_subtitle_attempt?: string | null;
  retryable?: boolean;
  subtitles?: VideoSubtitle[];
};

/** Lesson unit structure. */
type LessonItem = {
  _id?: string;
  title: string;
  description: string;
  videos: VideoItem[];
};

/** Quiz question model. */
type QuestionItem = {
  type: 'single' | 'multiple';
  prompt: string;
  options: { text: string }[];
  correctOptionIndexes: number[];
};

/** Quiz module containing questions. */
type QuizItem = {
  _id?: string;
  title: string;
  questions: QuestionItem[];
};

/** Chapter container for lessons and quizzes. */
type ChapterItem = {
  title: string;
  lessons: LessonItem[];
  quizzes: QuizItem[];
  _id?: string;
};

/** External resource/attachment model. */
type ResourceItem = {
  name: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
};

/** Comprehensive course state model. */
type CourseData = {
  title: string;
  description: string;
  thumbnailUrl: string;
  tags: string[];
  visibility: 'clinicians' | 'all';
  accessLevel: 'free' | 'develop' | 'master';
  chapters: ChapterItem[];
  resources: ResourceItem[];
};

const INITIAL_DATA: CourseData = {
  title: '',
  description: '',
  tags: [],
  accessLevel: 'free',
  visibility: 'all',
  thumbnailUrl: '',
  chapters: [],
  resources: [],
};



const STEPS = [
  { id: 1, name: 'Course Details', icon: BookOpen, description: 'Basic information' },
  { id: 2, name: 'Chapters', icon: Layers, description: 'Content & quizzes' },
  { id: 3, name: 'Attachments', icon: Paperclip, description: 'Resources' },
  { id: 4, name: 'Settings', icon: Settings, description: 'Access & visibility' },
  { id: 5, name: 'Review', icon: Eye, description: 'Publish' },
];

/** Visual progress tracker for the creation wizard. */
function StepIndicator({
  currentStep,
  onStepClick,
}: {
  currentStep: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <div className="w-full mb-6">
      <div className="flex items-center justify-between relative">

        <div
          className="absolute top-5 left-0 h-0.5 bg-muted mx-12 opacity-50"
          style={{ width: 'calc(100% - 6rem)' }}
        />

        <div
          className="absolute top-5 left-0 h-0.5 bg-primary mx-12 transition-all duration-500"
          style={{ width: `calc(${((currentStep - 1) / (STEPS.length - 1)) * 100}% - 6rem)` }}
        />

        {STEPS.map((step) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const Icon = step.icon;

          return (
            <button
              key={step.id}
              onClick={() => onStepClick(step.id)}
              className="flex flex-col items-center relative group"
            >
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                  ${isCompleted
                    ? 'bg-primary text-primary-foreground'
                    : isCurrent
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/20'
                      : 'bg-muted text-muted-foreground group-hover:bg-muted/80'
                  }
                `}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>
              <span
                className={`
                  mt-2 text-xs font-medium transition-colors
                  ${isCurrent ? 'text-primary' : 'text-muted-foreground'}
                `}
              >
                {step.name}
              </span>
              <span className="text-[10px] text-muted-foreground/70">{step.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Main course editor. Manages wizard state, persistence, and optimistic updates. */
export default function CourseCreation() {
  const [step, setStep] = useState<number>(1);
  const navigate = useNavigate();
  const { rolePath, courseId } = useParams();
  const [savedCourseId, setSavedCourseId] = useState<string | undefined>(undefined);
  const activeCourseId = courseId || savedCourseId;

  const [courseData, setCourseData] = useState<CourseData>(INITIAL_DATA);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);
  const resourcesInputRef = useRef<HTMLInputElement | null>(null);
  const lastLoadedIdRef = useRef<string | null>(null);
  const isExpectingResourceUpdate = useRef(false);
  const [activeChapter, setActiveChapter] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingResources, setIsUploadingResources] = useState(false);
  const [uploadingLessonIndex, setUploadingLessonIndex] = useState<number | null>(null);
  const [lessonUploadProgress, setLessonUploadProgress] = useState<number>(0);

  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [isAddingLesson, setIsAddingLesson] = useState(false);
  const [isAddingQuiz, setIsAddingQuiz] = useState(false);
  const [isDeletingChapter, setIsDeletingChapter] = useState<number | null>(null);
  const [isVideoPreviewOpen, setIsVideoPreviewOpen] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<{
    chapterTitle: string;
    lessonTitle: string;
    video: VideoItem;
  } | null>(null);

  // Debounce refs for auto-save operations
  const quizSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lessonSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const courseDataRef = useRef(courseData);

  const queryClient = useQueryClient();
  const { data: tags = [], isLoading: isLoadingTags } = useTags();
  const { data: existingCourse } = useCourse(activeCourseId);

  const createCourseMutation = useCreateCourse();
  const updateCourseMutation = useUpdateCourse();
  const changeStatusMutation = useChangeStatus();
  const uploadResourcesMutation = useUploadResources();
  const deleteResourceMutation = useDeleteResource();
  const addChapterMutation = useAddChapter();
  const deleteChapterMutation = useDeleteChapter();
  const addLessonMutation = useAddLesson();
  const deleteLessonMutation = useDeleteLesson();
  const addQuizMutation = useAddQuiz();
  const updateQuizMutation = useUpdateQuiz();
  const deleteQuizMutation = useDeleteQuiz();
  const deleteLessonVideoMutation = useDeleteLessonVideo();
  const retryCourseSubtitlesMutation = useRetryCourseSubtitles();
  const getSignedUploadUrlMutation = useGetCourseSignedUploadUrl();

  // V1 polling state: track which lesson slot is waiting for the webhook
  const [pollingSlot, setPollingSlot] = useState<{ chapterIndex: number; lessonIndex: number } | null>(null);

  // Poll until the Cloudinary webhook marks the video as ready
  const { data: pollVideoStatus } = usePollCourseVideoStatus(
    activeCourseId ?? undefined,
    pollingSlot?.chapterIndex ?? 0,
    pollingSlot?.lessonIndex ?? 0,
    pollingSlot !== null
  );

  useEffect(() => {
    if (!pollingSlot || !pollVideoStatus?.videoReady) return;
    // Webhook fired — refresh course data and clear the uploading state
    setPollingSlot(null);
    setUploadingLessonIndex(null);
    setLessonUploadProgress(0);
    // Sync latest lesson data (cloudinaryId, durationSeconds) from server
    queryClient.invalidateQueries({ queryKey: courseKeys.detail(activeCourseId!) });
    toast.success('Video processed successfully!');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollVideoStatus?.videoReady, pollingSlot]);

  const handleRetryCourseSubtitles = async (courseIdArg: string, cloudinaryId: string) => {
    try {
      await retryCourseSubtitlesMutation.mutateAsync({ courseId: courseIdArg, cloudinaryId });
      toast.success('Subtitle generation queued');
    } catch {
      toast.error('Failed to queue subtitle generation');
    }
  };

  useEffect(() => {
    if (existingCourse && activeCourseId) {
      if (isExpectingResourceUpdate.current) {
        // Partial update: only refresh resources to avoid losing form edits in progress
        setCourseData(prev => ({
          ...prev,
          resources: existingCourse.resources || []
        }));
        isExpectingResourceUpdate.current = false;
        return;
      }

      // Full sync from server — always re-map chapters so subtitle_status,
      // cloudinaryId and other server-set fields are always current.
      const isFirstLoad = lastLoadedIdRef.current !== activeCourseId;
      setCourseData(prev => ({
        // On first load, reset everything. On re-fetch, keep title/description/tags
        // the user may be actively editing, but always take chapters from server.
        title: isFirstLoad ? existingCourse.title : prev.title,
        description: isFirstLoad ? (existingCourse.description || '') : prev.description,
        thumbnailUrl: isFirstLoad ? (existingCourse.thumbnailUrl || '') : prev.thumbnailUrl,
        tags: isFirstLoad ? (existingCourse.tags || []) : prev.tags,
        visibility: isFirstLoad ? (existingCourse.visibility || 'all') : prev.visibility,
        accessLevel: isFirstLoad ? existingCourse.accessLevel : prev.accessLevel,
        resources: existingCourse.resources || [],
        // Always take chapters from server — this carries subtitle_status updates
        chapters: existingCourse.chapters?.map(ch => ({
          _id: ch._id,
          title: ch.title,
          lessons: ch.lessons?.map(l => ({
            _id: (l as any)._id,
            title: l.title,
            description: l.description,
            videos: (l.videos || []) as VideoItem[],
          })) || [],
          quizzes: ch.quizzes?.map(q => ({
            _id: (q as any)._id,
            title: q.title,
            questions: q.questions || []
          })) || []
        })) || [],
      }));

      if (isFirstLoad) {
        lastLoadedIdRef.current = activeCourseId;
      }
    }
  }, [existingCourse, activeCourseId]);

  // Keep courseDataRef in sync with courseData for debounced saves
  useEffect(() => {
    courseDataRef.current = courseData;
  }, [courseData]);

  const handleSaveCourse = async (submitForReview = false, shouldNavigate = true, dataOverride?: CourseData): Promise<string | undefined> => {
    const dataToSave = dataOverride || courseData;

    // Basic integrity check.
    if (!dataToSave.title.trim()) {
      toast.error('Course title is required.');
      return;
    }

    // Strict validation for publishing/review.
    if (submitForReview) {
      if (!dataToSave.description.trim()) {
        toast.error('Course description is required for publishing.');
        return;
      }
      if (dataToSave.chapters.length === 0) {
        toast.error('At least one chapter is required for publishing.');
        return;
      }

      // Verify course has actual content.
      const hasContent = dataToSave.chapters.some(
        (chapter) => chapter.lessons.length > 0 || chapter.quizzes.length > 0
      );

      if (!hasContent) {
        toast.error('At least one lesson or quiz is required for publishing.');
        return;
      }

      if (dataToSave.tags.length === 0) {
        toast.error('Please select at least one Learning Area.');
        return;
      }
      if (!dataToSave.visibility) {
        toast.error('Please select a Visibility option.');
        return;
      }
      if (!dataToSave.accessLevel) {
        toast.error('Please select an Access Level.');
        return;
      }

      setIsSubmitting(true);
    } else {
      setIsSaving(true);
    }

    try {
      let currentCourseId = activeCourseId;

      if (activeCourseId) {
        // Update existing course entity.
        // Note: Chapters, lessons, quizzes, and videos are managed via their own endpoints
        await updateCourseMutation.mutateAsync({
          courseId: activeCourseId,
          data: {
            title: dataToSave.title,
            description: dataToSave.description,
            accessLevel: dataToSave.accessLevel,
            tags: dataToSave.tags,
            visibility: dataToSave.visibility,
            thumbnail: thumbnailFile || undefined,
            thumbnailUrl: dataToSave.thumbnailUrl,
          }
        });

      } else {
        // Initialize new course entity.
        const course = await createCourseMutation.mutateAsync({
          title: dataToSave.title,
          description: dataToSave.description,
          accessLevel: dataToSave.accessLevel,
          tags: dataToSave.tags.join(','),
          thumbnail: thumbnailFile || undefined,
        });
        currentCourseId = course._id!;
        setSavedCourseId(currentCourseId);
      }

      if (!currentCourseId) throw new Error("Course ID not found");

      if (submitForReview) {
        await changeStatusMutation.mutateAsync({
          courseId: currentCourseId,
          status: rolePath === 'super-admin' ? 'published' : 'pending',
        });
        toast.success(rolePath === 'super-admin' ? 'Course published successfully!' : 'Course submitted for review!');
      } else {
        if (shouldNavigate) {
          toast.success('Course saved successfully!');
        } else {
          toast.success('Course draft auto-saved.');
        }
      }

      if (shouldNavigate) {
        navigate(rolePath ? `/${rolePath}/content/courses` : '/content/courses');
      } else if (!courseId && currentCourseId) {
        // Transition to edit mode after initial auto-save.
        // This ensures subsequent saves update the existing entity.
        const editPath = rolePath
          ? `/${rolePath}/content/courses/${currentCourseId}/edit`
          : `/content/courses/${currentCourseId}/edit`;
        // Prevent state regression by marking current ID as fresh.
        lastLoadedIdRef.current = currentCourseId;
        navigate(editPath, { replace: true });
      }

      return currentCourseId;
    } catch (error) {
      console.error('Error saving course:', error);
      toast.error('Failed to save course. Please try again.');
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };

  const handleThumbnailUpload = (file: File) => {
    if (file) {
      setThumbnailFile(file);
      // Generate local preview for immediate feedback.
      const reader = new FileReader();
      reader.onloadend = () => {
        setCourseData({ ...courseData, thumbnailUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResourceUpload = async (files: File[]) => {
    let targetCourseId = activeCourseId;

    if (!targetCourseId) {
      // Ensure entity exists before attaching resources.
      try {
        targetCourseId = await handleSaveCourse(false, false);
      } catch (e) {
        // Error handled in parent; safe to ignore.
      }
    }

    if (!targetCourseId) {
      toast.error("Please save the course first before uploading resources.");
      return;
    }

    setIsUploadingResources(true);
    isExpectingResourceUpdate.current = true; // Flag expectation of external update to prevent state clobbering.
    try {
      const updatedCourse = await uploadResourcesMutation.mutateAsync({ courseId: targetCourseId, files });
      toast.success("Resources uploaded successfully");

      // Optimistic update using response data.
      if (updatedCourse?.resources) {
        setCourseData(prev => ({
          ...prev,
          resources: updatedCourse.resources
        }));
        // Reset flag: sync complete.
        isExpectingResourceUpdate.current = false;
      } else {
        // Fallback: rely on query invalidation.
      }
    } catch (error) {
      console.error("Failed to upload resources", error);
      toast.error("Failed to upload resources");
      isExpectingResourceUpdate.current = false; // Reset flag on failure to restore normal sync behavior.
    } finally {
      setIsUploadingResources(false);
    }
  };



  /**
   * Ensures the course exists before performing chapter/lesson operations.
   * Creates a draft course if none exists yet.
   */
  const ensureCourseExists = async (): Promise<string | undefined> => {
    if (activeCourseId) return activeCourseId;

    if (!courseData.title.trim()) {
      toast.error('Please enter a course title first');
      return undefined;
    }

    try {
      const course = await createCourseMutation.mutateAsync({
        title: courseData.title,
        description: courseData.description || 'Draft course',
        accessLevel: courseData.accessLevel,
        tags: courseData.tags.join(','),
        thumbnail: thumbnailFile || undefined,
      });

      const newCourseId = course._id!;
      setSavedCourseId(newCourseId);
      lastLoadedIdRef.current = newCourseId;

      // Navigate to edit mode with the new course ID
      const editPath = rolePath
        ? `/${rolePath}/content/courses/${newCourseId}/edit`
        : `/content/courses/${newCourseId}/edit`;
      navigate(editPath, { replace: true });

      toast.success('Course draft created');
      return newCourseId;
    } catch (error) {
      console.error('Error creating course:', error);
      toast.error('Failed to create course');
      return undefined;
    }
  };

  const addChapter = async () => {
    // Prevent duplicate clicks
    if (isAddingChapter) return;

    const targetCourseId = await ensureCourseExists();
    if (!targetCourseId) return;

    setIsAddingChapter(true);

    // Optimistic update - add chapter immediately to UI
    const tempId = `temp-${Date.now()}`;
    const chapterTitle = `Chapter ${courseData.chapters.length + 1}`;
    const optimisticChapter = {
      _id: tempId,
      title: chapterTitle,
      lessons: [],
      quizzes: [],
    };

    setCourseData(prev => ({
      ...prev,
      chapters: [...prev.chapters, optimisticChapter],
    }));
    setActiveChapter(courseData.chapters.length); // New chapter index

    try {
      const newChapter = await addChapterMutation.mutateAsync({
        courseId: targetCourseId,
        title: chapterTitle,
      });

      // Update the temp chapter with real ID from server
      setCourseData(prev => ({
        ...prev,
        chapters: prev.chapters.map(ch =>
          ch._id === tempId
            ? { ...ch, _id: (newChapter as any)?._id || tempId }
            : ch
        ),
      }));
      toast.success('Chapter added');
    } catch (error) {
      // Rollback optimistic update on error
      setCourseData(prev => ({
        ...prev,
        chapters: prev.chapters.filter(ch => ch._id !== tempId),
      }));
      console.error('Error adding chapter:', error);
      toast.error('Failed to add chapter');
    } finally {
      setIsAddingChapter(false);
    }
  };



  const deleteChapter = async (index: number) => {
    // Prevent duplicate clicks
    if (isDeletingChapter !== null) return;
    if (!activeCourseId) return;

    setIsDeletingChapter(index);

    // Store original state for rollback
    const originalChapters = [...courseData.chapters];
    const originalActiveChapter = activeChapter;

    // Optimistic update - remove chapter immediately
    const updatedChapters = courseData.chapters.filter((_, i) => i !== index);
    setCourseData(prev => ({ ...prev, chapters: updatedChapters }));

    if (activeChapter >= updatedChapters.length) {
      setActiveChapter(Math.max(0, updatedChapters.length - 1));
    }

    try {
      await deleteChapterMutation.mutateAsync({
        courseId: activeCourseId,
        chapterIndex: index,
      });
      toast.success('Chapter deleted');
    } catch (error) {
      // Rollback optimistic update on error
      setCourseData(prev => ({ ...prev, chapters: originalChapters }));
      setActiveChapter(originalActiveChapter);
      console.error('Error deleting chapter:', error);
      toast.error('Failed to delete chapter');
    } finally {
      setIsDeletingChapter(null);
    }
  };


  const updateChapterTitle = (index: number, title: string) => {
    const updatedChapters = [...courseData.chapters];
    updatedChapters[index].title = title;
    setCourseData({ ...courseData, chapters: updatedChapters });
    // Note: Title updates are persisted when saving the full course or on blur (debounced)
  };



  const addLesson = async () => {
    // Prevent duplicate clicks
    if (isAddingLesson) return;

    const targetCourseId = await ensureCourseExists();
    if (!targetCourseId) return;

    if (courseData.chapters.length === 0) {
      toast.error('Please add a chapter first');
      return;
    }

    // Each chapter can only have one lesson
    if (courseData.chapters[activeChapter].lessons.length > 0) {
      toast.error('Each chapter can only have one lesson');
      return;
    }

    setIsAddingLesson(true);

    // Optimistic update - add lesson immediately
    const tempId = `temp-${Date.now()}`;
    const lessonTitle = `Lesson`;
    const optimisticLesson = {
      _id: tempId,
      title: lessonTitle,
      description: '',
      videos: [],
    };

    const currentChapter = activeChapter;
    setCourseData(prev => {
      const updatedChapters = [...prev.chapters];
      updatedChapters[currentChapter] = {
        ...updatedChapters[currentChapter],
        lessons: [optimisticLesson],
      };
      return { ...prev, chapters: updatedChapters };
    });

    try {
      const newLesson = await addLessonMutation.mutateAsync({
        courseId: targetCourseId,
        chapterIndex: currentChapter,
        lesson: {
          title: lessonTitle,
          description: '',
          videos: [],
        },
      });

      // Update with real ID from server
      setCourseData(prev => {
        const updatedChapters = [...prev.chapters];
        updatedChapters[currentChapter] = {
          ...updatedChapters[currentChapter],
          lessons: updatedChapters[currentChapter].lessons.map(l =>
            l._id === tempId ? { ...l, _id: (newLesson as any)?._id || tempId } : l
          ),
        };
        return { ...prev, chapters: updatedChapters };
      });

      toast.success('Lesson added');
    } catch (error) {
      // Rollback optimistic update
      setCourseData(prev => {
        const updatedChapters = [...prev.chapters];
        updatedChapters[currentChapter] = {
          ...updatedChapters[currentChapter],
          lessons: [],
        };
        return { ...prev, chapters: updatedChapters };
      });
      console.error('Error adding lesson:', error);
      toast.error('Failed to add lesson');
    } finally {
      setIsAddingLesson(false);
    }
  };



  const deleteLesson = async (lessonIndex: number) => {
    if (!activeCourseId) return;

    try {
      await deleteLessonMutation.mutateAsync({
        courseId: activeCourseId,
        chapterIndex: activeChapter,
        lessonIndex,
      });

      // Optimistically update local state
      const updatedChapters = [...courseData.chapters];
      updatedChapters[activeChapter].lessons = updatedChapters[activeChapter].lessons.filter(
        (_, i) => i !== lessonIndex
      );
      setCourseData(prev => ({ ...prev, chapters: updatedChapters }));

      toast.success('Lesson deleted');
    } catch (error) {
      console.error('Error deleting lesson:', error);
      toast.error('Failed to delete lesson');
    }
  };


  const updateLesson = (lessonIndex: number, field: 'title' | 'description', value: string) => {
    const updatedChapters = [...courseData.chapters];
    updatedChapters[activeChapter].lessons[lessonIndex][field] = value;
    setCourseData({ ...courseData, chapters: updatedChapters });
  };

  /**
   * Syncs a lesson's current state to the backend (debounced).
   * Uses setTimeout to ensure React state updates complete before reading.
   * Uses addLesson endpoint which does upsert (add or update first lesson).
   */
  const saveLesson = (chapterIndex: number, lessonIndex: number) => {
    if (!activeCourseId) return;

    // Clear any pending save for this lesson
    if (lessonSaveTimerRef.current) {
      clearTimeout(lessonSaveTimerRef.current);
    }

    // Debounce: wait for React state to update, then save
    lessonSaveTimerRef.current = setTimeout(async () => {
      const currentData = courseDataRef.current;
      const lesson = currentData.chapters[chapterIndex]?.lessons[lessonIndex];
      if (!lesson) return;

      // Only save if lesson has minimum required data (title)
      if (!lesson.title.trim()) {
        console.log('Lesson not ready for save - no title');
        return;
      }

      try {
        // Use addLesson which is the documented upsert endpoint
        await addLessonMutation.mutateAsync({
          courseId: activeCourseId,
          chapterIndex,
          lesson: {
            title: lesson.title,
            description: lesson.description,
            videos: lesson.videos.map(v => ({
              cloudinaryUrl: v.cloudinaryUrl || '',
              cloudinaryId: v.cloudinaryId || '',
              durationSeconds: v.durationSeconds || 0,
              thumbnailUrl: v.thumbnailUrl || '',
            })),
          },
        });
      } catch (error) {
        console.error('Error saving lesson:', error);
      }
    }, 300);
  };

  const handleVideoUpload = async (lessonIndex: number, file: File) => {
    if (!file.type.startsWith('video/')) {
      toast.error('Please select a valid video file');
      return;
    }

    if (file.size > 2 * 1024 * 1024 * 1024) {
      toast.error('File size exceeds the 2 GB limit');
      return;
    }

    const targetCourseId = await ensureCourseExists();
    if (!targetCourseId) return;

    setUploadingLessonIndex(lessonIndex);
    setLessonUploadProgress(0);

    try {
      // Phase 1 — get backend-signed upload credentials
      const signedData = await getSignedUploadUrlMutation.mutateAsync({
        courseId: targetCourseId,
        chapterIndex: activeChapter,
        lessonIndex,
      });

      // Phase 2 — upload directly from the browser to Cloudinary (XHR for progress)
      const formPayload = new FormData();
      formPayload.append('file', file);
      Object.entries(signedData.fields).forEach(([key, val]) => {
        formPayload.append(key, String(val));
      });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', signedData.uploadUrl, true);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setLessonUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Cloudinary upload failed: ${xhr.statusText}`));
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formPayload);
      });

      // Phase 3 — start polling; webhook will update the DB record
      setPollingSlot({ chapterIndex: activeChapter, lessonIndex });
      toast.info('Video uploaded — waiting for processing…');
      // uploadingLessonIndex stays set until polling resolves (the useEffect above clears it)
    } catch (error) {
      console.error('Video upload error:', error);
      toast.error('Failed to upload video. Please try again.');
      setUploadingLessonIndex(null);
      setLessonUploadProgress(0);
    }
  };

  const handleDeleteVideo = async (lessonIndex: number) => {
    if (!activeCourseId) return;

    try {
      // Use atomic delete API (DB + Cloudinary)
      await deleteLessonVideoMutation.mutateAsync({
        courseId: activeCourseId,
        chapterIndex: activeChapter,
        lessonIndex,
        videoIndex: 0 // Currently assuming 1 video per lesson
      });

      // Update local state
      const updatedChapters = [...courseData.chapters];
      updatedChapters[activeChapter].lessons[lessonIndex].videos = [];
      setCourseData(prev => ({ ...prev, chapters: updatedChapters }));

      toast.success('Video removed');
    } catch (error) {
      console.error('Error removing video:', error);
      toast.error('Failed to remove video');
    }
  };


  const addQuiz = async () => {
    // Prevent duplicate clicks
    if (isAddingQuiz) return;

    const targetCourseId = await ensureCourseExists();
    if (!targetCourseId) return;

    if (courseData.chapters.length === 0) {
      toast.error('Please add a chapter first');
      return;
    }

    // Each chapter can only have one quiz
    if (courseData.chapters[activeChapter].quizzes.length > 0) {
      toast.error('Each chapter can only have one quiz');
      return;
    }

    setIsAddingQuiz(true);

    // Optimistic update - add quiz immediately
    const tempId = `temp-${Date.now()}`;
    const quizTitle = `Quiz`;
    const optimisticQuiz = {
      _id: tempId,
      title: quizTitle,
      questions: [],
    };

    const currentChapter = activeChapter;
    setCourseData(prev => {
      const updatedChapters = [...prev.chapters];
      updatedChapters[currentChapter] = {
        ...updatedChapters[currentChapter],
        quizzes: [optimisticQuiz],
      };
      return { ...prev, chapters: updatedChapters };
    });

    try {
      const newQuiz = await addQuizMutation.mutateAsync({
        courseId: targetCourseId,
        chapterIndex: currentChapter,
        quiz: {
          title: quizTitle,
          questions: [],
        },
      });

      // Update with real ID from server
      setCourseData(prev => {
        const updatedChapters = [...prev.chapters];
        updatedChapters[currentChapter] = {
          ...updatedChapters[currentChapter],
          quizzes: updatedChapters[currentChapter].quizzes.map(q =>
            q._id === tempId ? { ...q, _id: (newQuiz as any)?._id || tempId } : q
          ),
        };
        return { ...prev, chapters: updatedChapters };
      });

      toast.success('Quiz added');
    } catch (error) {
      // Rollback optimistic update
      setCourseData(prev => {
        const updatedChapters = [...prev.chapters];
        updatedChapters[currentChapter] = {
          ...updatedChapters[currentChapter],
          quizzes: [],
        };
        return { ...prev, chapters: updatedChapters };
      });
      console.error('Error adding quiz:', error);
      toast.error('Failed to add quiz');
    } finally {
      setIsAddingQuiz(false);
    }
  };



  const deleteQuiz = async (quizIndex: number) => {
    if (!activeCourseId) return;

    try {
      await deleteQuizMutation.mutateAsync({
        courseId: activeCourseId,
        chapterIndex: activeChapter,
        quizIndex,
      });

      // Optimistically update local state
      const updatedChapters = [...courseData.chapters];
      updatedChapters[activeChapter].quizzes = updatedChapters[activeChapter].quizzes.filter(
        (_, i) => i !== quizIndex
      );
      setCourseData(prev => ({ ...prev, chapters: updatedChapters }));

      toast.success('Quiz deleted');
    } catch (error) {
      console.error('Error deleting quiz:', error);
      toast.error('Failed to delete quiz');
    }
  };


  /**
   * Checks if a quiz has complete, valid data for saving.
   * Returns true only if all required fields are properly filled.
   */
  const isQuizValid = (quiz: { title: string; questions: Array<{ prompt: string; options: Array<{ text: string }>; correctOptionIndexes: number[] }> }) => {
    // Must have a title
    if (!quiz.title.trim()) return false;

    // Must have at least one question
    if (!quiz.questions || quiz.questions.length === 0) return false;

    // Each question must be complete
    return quiz.questions.every(question => {
      // Must have a prompt
      if (!question.prompt.trim()) return false;

      // Must have at least one option with text
      const validOptions = question.options.filter(opt => opt.text.trim());
      if (validOptions.length === 0) return false;

      // Must have at least one correct answer selected
      if (!question.correctOptionIndexes || question.correctOptionIndexes.length === 0) return false;

      // Correct indexes must be within valid range
      const maxIndex = question.options.length - 1;
      const allIndexesValid = question.correctOptionIndexes.every(idx => idx >= 0 && idx <= maxIndex);
      if (!allIndexesValid) return false;

      return true;
    });
  };


  /**
   * Syncs a quiz's current state to the backend (debounced).
   * Uses setTimeout to ensure React state updates complete before reading.
   * Only saves if quiz data is complete and valid.
   */
  const saveQuiz = (chapterIndex: number, quizIndex: number) => {
    if (!activeCourseId) return;

    // Clear any pending save for this quiz
    if (quizSaveTimerRef.current) {
      clearTimeout(quizSaveTimerRef.current);
    }

    // Debounce: wait for React state to update, then save
    quizSaveTimerRef.current = setTimeout(async () => {
      const currentData = courseDataRef.current;
      const quiz = currentData.chapters[chapterIndex]?.quizzes[quizIndex];
      if (!quiz) return;

      // Only save if quiz is complete and valid
      if (!isQuizValid(quiz)) {
        console.log('Quiz not ready for save - incomplete data');
        return;
      }

      try {
        await updateQuizMutation.mutateAsync({
          courseId: activeCourseId,
          chapterIndex,
          quiz: {
            title: quiz.title,
            questions: quiz.questions,
          },
        });
      } catch (error) {
        console.error('Error saving quiz:', error);
      }
    }, 300);
  };


  const updateQuizTitle = (quizIndex: number, title: string) => {
    const updatedChapters = [...courseData.chapters];
    updatedChapters[activeChapter].quizzes[quizIndex].title = title;
    setCourseData({ ...courseData, chapters: updatedChapters });
  };

  const addQuestion = (quizIndex: number) => {
    const updatedChapters = [...courseData.chapters];
    updatedChapters[activeChapter].quizzes[quizIndex].questions.push({
      type: 'single',
      prompt: '',
      options: [{ text: '' }, { text: '' }],
      correctOptionIndexes: [],
    });
    setCourseData({ ...courseData, chapters: updatedChapters });
  };

  const deleteQuestion = (quizIndex: number, questionIndex: number) => {
    const updatedChapters = [...courseData.chapters];
    updatedChapters[activeChapter].quizzes[quizIndex].questions = updatedChapters[
      activeChapter
    ].quizzes[quizIndex].questions.filter((_, i) => i !== questionIndex);
    setCourseData({ ...courseData, chapters: updatedChapters });
  };

  const updateQuestion = (
    quizIndex: number,
    questionIndex: number,
    field: 'type' | 'prompt',
    value: string
  ) => {
    const updatedChapters = [...courseData.chapters];
    const question = updatedChapters[activeChapter].quizzes[quizIndex].questions[questionIndex];
    if (field === 'type') {
      question.type = value as 'single' | 'multiple';
      question.correctOptionIndexes = [];
    } else {
      question.prompt = value;
    }
    setCourseData({ ...courseData, chapters: updatedChapters });
  };

  const addOption = (quizIndex: number, questionIndex: number) => {
    const updatedChapters = [...courseData.chapters];
    updatedChapters[activeChapter].quizzes[quizIndex].questions[questionIndex].options.push({
      text: '',
    });
    setCourseData({ ...courseData, chapters: updatedChapters });
  };

  const updateOption = (
    quizIndex: number,
    questionIndex: number,
    optionIndex: number,
    value: string
  ) => {
    const updatedChapters = [...courseData.chapters];
    updatedChapters[activeChapter].quizzes[quizIndex].questions[questionIndex].options[
      optionIndex
    ].text = value;
    setCourseData({ ...courseData, chapters: updatedChapters });
  };

  const deleteOption = (quizIndex: number, questionIndex: number, optionIndex: number) => {
    const updatedChapters = [...courseData.chapters];
    const question = updatedChapters[activeChapter].quizzes[quizIndex].questions[questionIndex];
    question.options = question.options.filter((_, i) => i !== optionIndex);
    question.correctOptionIndexes = question.correctOptionIndexes
      .filter((i) => i !== optionIndex)
      .map((i) => (i > optionIndex ? i - 1 : i));
    setCourseData({ ...courseData, chapters: updatedChapters });
  };

  const toggleCorrectAnswer = (quizIndex: number, questionIndex: number, optionIndex: number) => {
    const updatedChapters = [...courseData.chapters];
    const question = updatedChapters[activeChapter].quizzes[quizIndex].questions[questionIndex];
    if (question.type === 'single') {
      question.correctOptionIndexes = [optionIndex];
    } else {
      if (question.correctOptionIndexes.includes(optionIndex)) {
        question.correctOptionIndexes = question.correctOptionIndexes.filter(
          (i) => i !== optionIndex
        );
      } else {
        question.correctOptionIndexes.push(optionIndex);
      }
    }
    setCourseData({ ...courseData, chapters: updatedChapters });
  };


  const toggleCategory = (slug: string) => {
    const tags = courseData.tags.includes(slug)
      ? courseData.tags.filter((t) => t !== slug)
      : [...courseData.tags, slug];
    setCourseData({ ...courseData, tags });
  };


  const deleteResource = async (index: number) => {
    if (activeCourseId) {
      isExpectingResourceUpdate.current = true;
      try {
        await deleteResourceMutation.mutateAsync({ courseId: activeCourseId, resourceIndex: index });
        toast.success("Resource deleted");

        // Optimistic deletion: update UI immediately to prevent list instability.
        // We trust our local index logic over the backend response for deletions to avoid race conditions.
        setCourseData(prev => ({
          ...prev,
          resources: prev.resources.filter((_, i) => i !== index)
        }));

        isExpectingResourceUpdate.current = false;
      } catch (e) {
        console.error("Failed to delete resource", e);
        toast.error("Failed to delete resource");
        isExpectingResourceUpdate.current = false;
      }
    } else {
      const updatedResources = courseData.resources.filter((_, i) => i !== index);
      setCourseData({ ...courseData, resources: updatedResources });
    }
  };


  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };


  const goToStep = async (newStep: number) => {
    // Validate prerequisites before advancing.
    if (step === 1 && newStep > step) {
      if (!courseData.title.trim()) {
        toast.error('Course title is required to proceed');
        return;
      }
      if (!courseData.description.trim()) {
        toast.error('Course description is required to proceed');
        return;
      }
      // Auto-save course in background when moving forward from step 1
      // Don't await - navigate immediately for better UX
      handleSaveCourse(false, false).catch((error) => {
        console.error('Auto-save failed:', error);
      });
    }

    if (newStep >= 1 && newStep <= 5) {
      setStep(newStep);
    }
  };

  const handleCancel = () => {
    navigate(rolePath ? `/${rolePath}/content/courses` : '/content/courses');
  };


  const renderCourseDetails = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Course Details</h2>
          <p className="text-sm text-muted-foreground">Set up the basic information for your course</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-5">
          <Card>
            <CardContent className="pt-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">
                  Course Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="title"
                  value={courseData.title}
                  onChange={(e) => setCourseData({ ...courseData, title: e.target.value })}
                  placeholder="Enter an engaging course title"
                  className="h-11 bg-background/50"
                />
                <p className="text-xs text-muted-foreground">
                  {courseData.title.length}/100 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  value={courseData.description}
                  onChange={(e) => setCourseData({ ...courseData, description: e.target.value })}
                  placeholder="Describe what students will learn in this course..."
                  rows={6}
                  className="resize-none bg-background/50"
                />
                <p className="text-xs text-muted-foreground">
                  {courseData.description.length}/500 characters
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Course Thumbnail</Label>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {courseData.thumbnailUrl ? (
                <div className="relative group">
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={courseData.thumbnailUrl}
                      alt="Course thumbnail"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <input
                      ref={thumbnailInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleThumbnailUpload(e.target.files[0])}
                    />
                    <div
                      className="flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3 rounded-md text-sm font-medium cursor-pointer"
                      onClick={() => thumbnailInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Change
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setCourseData({ ...courseData, thumbnailUrl: '' })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="cursor-pointer block">
                  <input
                    ref={thumbnailInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleThumbnailUpload(e.target.files[0])}
                  />
                  <div
                    className="aspect-video flex flex-col items-center justify-center bg-gradient-to-br from-muted/50 to-muted border-2 border-dashed border-muted-foreground/20 rounded-lg m-4 cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => thumbnailInputRef.current?.click()}
                  >
                    <div className="p-4 rounded-full bg-muted mb-3">
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">Drop image here or click to upload</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Recommended: 1280×720px (16:9)
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );


  const renderChapters = () => (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Layers className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Chapters & Content</h2>
          <p className="text-sm text-muted-foreground">Build your course structure with lessons and quizzes</p>
        </div>
      </div>

      <div className="flex gap-6 h-[calc(100vh-280px)] min-h-[500px]">
        <Card className="w-64 flex-shrink-0 flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Chapters</CardTitle>
              <Button
                onClick={addChapter}
                size="sm"
                variant="outline"
                className="h-8"
                disabled={isAddingChapter || uploadingLessonIndex !== null || isDeletingChapter !== null}
              >
                <Plus className="w-4 h-4 mr-1" />
                {isAddingChapter ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full px-4 pb-4">
              <div className="space-y-2">
                {courseData.chapters.map((chapter, index) => (
                  <div
                    key={chapter._id}
                    onClick={() => setActiveChapter(index)}
                    className={`
                      group p-3 rounded-lg cursor-pointer transition-all duration-200
                      ${activeChapter === index
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 hover:bg-muted'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 opacity-40" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{chapter.title}</p>
                        <p
                          className={`text-xs mt-0.5 ${activeChapter === index
                            ? 'text-primary-foreground/70'
                            : 'text-muted-foreground'
                            }`}
                        >
                          {chapter.lessons.length} lessons • {chapter.quizzes.length} quizzes
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isDeletingChapter !== null || uploadingLessonIndex !== null || isAddingChapter}
                        className={`h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${activeChapter === index
                          ? 'hover:bg-primary-foreground/20'
                          : 'hover:bg-destructive/10 hover:text-destructive'
                          }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChapter(index);
                        }}
                      >
                        {isDeletingChapter === index ? (
                          <span className="w-4 h-4 animate-spin">⟳</span>
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </Button>

                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6">
              {courseData.chapters.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground border-2 border-dashed rounded-lg">
                  <Layers className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-lg font-medium">No chapters yet</p>
                  <p className="text-sm">Add a chapter to start building your course content</p>
                  <Button onClick={addChapter} variant="outline" className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Chapter
                  </Button>
                </div>
              ) : !courseData.chapters[activeChapter] ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <p>Select a chapter to edit</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Chapter Title */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Chapter Title</Label>
                    <Input
                      value={courseData.chapters[activeChapter].title}
                      onChange={(e) => updateChapterTitle(activeChapter, e.target.value)}
                      placeholder="Enter chapter title"
                      className="text-lg font-medium h-11"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4 text-primary" />
                      <span className="font-medium">Lessons</span>
                      <Badge variant="secondary" className="ml-2">
                        {courseData.chapters[activeChapter].lessons.length}
                      </Badge>
                    </div>
                    <div className="space-y-4">
                      {courseData.chapters[activeChapter].lessons.map((lesson, lessonIndex) => (
                        <Card key={lessonIndex} className="border">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-medium text-muted-foreground">
                                Lesson {lessonIndex + 1}
                              </CardTitle>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => deleteLesson(lessonIndex)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-xs">Title</Label>
                              <Input
                                value={lesson.title}
                                onChange={(e) =>
                                  updateLesson(lessonIndex, 'title', e.target.value)
                                }
                                onBlur={() => saveLesson(activeChapter, lessonIndex)}
                                placeholder="Lesson title"
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Description</Label>
                              <Textarea
                                value={lesson.description}
                                onChange={(e) =>
                                  updateLesson(lessonIndex, 'description', e.target.value)
                                }
                                onBlur={() => saveLesson(activeChapter, lessonIndex)}
                                placeholder="Brief description of this lesson"
                                rows={2}
                                className="resize-none"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Video</Label>
                              {lesson.videos.length > 0 ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                                    <button
                                      type="button"
                                      className="relative w-24 h-14 rounded overflow-hidden flex-shrink-0 bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                      onClick={() => {
                                        const video = lesson.videos[0];
                                        setPreviewVideo({
                                          chapterTitle: courseData.chapters[activeChapter].title,
                                          lessonTitle: lesson.title,
                                          video,
                                        });
                                        setIsVideoPreviewOpen(true);
                                      }}
                                    >
                                      {lesson.videos[0].thumbnailUrl ? (
                                        <img
                                          src={lesson.videos[0].thumbnailUrl}
                                          alt="Video thumbnail"
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <Video className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                      )}
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                        <Play className="w-6 h-6 text-white" />
                                      </div>
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">Video uploaded</p>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Clock className="w-3 h-3" />
                                        {formatDuration(lesson.videos[0].durationSeconds || 0)}
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteVideo(lessonIndex);
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                  {activeCourseId && lesson.videos[0]?.cloudinaryId && (
                                    <SubtitleStatusCard
                                      variant="slim"
                                      status={lesson.videos[0].subtitle_status}
                                      failureReason={lesson.videos[0].subtitle_failure_reason}
                                      retryCount={lesson.videos[0].subtitle_retry_count}
                                      lastAttempt={lesson.videos[0].last_subtitle_attempt}
                                      retryable={lesson.videos[0].retryable}
                                      hasSubtitleUrl={lesson.videos[0].subtitles?.some((s) => s.format === 'vtt')}
                                      isRetrying={retryCourseSubtitlesMutation.isPending}
                                      onRetry={() =>
                                        handleRetryCourseSubtitles(
                                          activeCourseId,
                                          lesson.videos[0].cloudinaryId!
                                        )
                                      }
                                    />
                                  )}
                                </div>
                              ) : uploadingLessonIndex === lessonIndex ? (
                                <div className="border-2 border-dashed rounded-lg p-6 text-center border-primary/50">
                                  <Loader2 className="w-8 h-8 mx-auto text-primary mb-2 animate-spin" />
                                  {pollingSlot?.chapterIndex === activeChapter && pollingSlot?.lessonIndex === lessonIndex ? (
                                    <>
                                      <p className="text-sm font-medium">Processing video…</p>
                                      <p className="text-xs text-muted-foreground mb-2">
                                        Cloudinary is transcoding. This may take a moment.
                                      </p>
                                      <Progress value={undefined} className="h-1 animate-pulse" />
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-sm font-medium">Uploading video…</p>
                                      <p className="text-xs text-muted-foreground mb-2">
                                        {lessonUploadProgress}% complete
                                      </p>
                                      <Progress value={lessonUploadProgress} className="h-1" />
                                    </>
                                  )}
                                </div>
                              ) : (
                                <label className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer block">
                                  <input
                                    type="file"
                                    accept="video/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleVideoUpload(lessonIndex, file);
                                      e.target.value = '';
                                    }}
                                  />
                                  <Video className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                                  <p className="text-sm font-medium">Upload video</p>
                                  <p className="text-xs text-muted-foreground">
                                    MP4, MOV up to 2GB
                                  </p>
                                </label>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {courseData.chapters[activeChapter].lessons.length === 0 && (
                        <Button
                          onClick={addLesson}
                          variant="outline"
                          className="w-full"
                          disabled={isAddingLesson || uploadingLessonIndex !== null || isAddingChapter}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          {isAddingLesson ? 'Adding...' : 'Add Lesson'}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="font-medium">Quizzes</span>
                      <Badge variant="secondary" className="ml-2">
                        {courseData.chapters[activeChapter].quizzes.length}
                      </Badge>
                    </div>
                    <div className="space-y-4">
                      {courseData.chapters[activeChapter].quizzes.map((quiz, quizIndex) => (
                        <Card key={quizIndex} className="border">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <Input
                                value={quiz.title}
                                onChange={(e) => updateQuizTitle(quizIndex, e.target.value)}
                                onBlur={() => saveQuiz(activeChapter, quizIndex)}
                                className="font-medium h-9 flex-1"
                                placeholder="Quiz title"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => deleteQuiz(quizIndex)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {quiz.questions.map((question, qIndex) => (
                              <div
                                key={qIndex}
                                className="p-4 rounded-lg bg-muted/30 border-l-2 border-primary space-y-4"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-3">
                                      <Badge variant="outline" className="text-xs">
                                        Q{qIndex + 1}
                                      </Badge>
                                      <Select
                                        value={question.type}
                                        onValueChange={(value) =>
                                          updateQuestion(quizIndex, qIndex, 'type', value)
                                        }
                                      >
                                        <SelectTrigger className="w-40 h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="single">Single Choice</SelectItem>
                                          <SelectItem value="multiple">Multiple Choice</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <Input
                                      value={question.prompt}
                                      onChange={(e) =>
                                        updateQuestion(quizIndex, qIndex, 'prompt', e.target.value)
                                      }
                                      onBlur={() => saveQuiz(activeChapter, quizIndex)}
                                      placeholder="Enter your question"
                                      className="h-9"
                                    />
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-destructive"
                                    onClick={() => deleteQuestion(quizIndex, qIndex)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>

                                <div className="space-y-2 pl-2">
                                  <Label className="text-xs text-muted-foreground">
                                    Options (check correct answers)
                                  </Label>
                                  {question.type === 'single' ? (
                                    <RadioGroup
                                      value={
                                        question.correctOptionIndexes[0]?.toString() || ''
                                      }
                                      onValueChange={(value) =>
                                        toggleCorrectAnswer(quizIndex, qIndex, parseInt(value))
                                      }
                                    >
                                      {question.options.map((option, optIndex) => (
                                        <div key={optIndex} className="flex items-center gap-2">
                                          <RadioGroupItem
                                            value={optIndex.toString()}
                                            id={`q${qIndex}-opt${optIndex}`}
                                          />
                                          <Input
                                            value={option.text}
                                            onChange={(e) =>
                                              updateOption(
                                                quizIndex,
                                                qIndex,
                                                optIndex,
                                                e.target.value
                                              )
                                            }
                                            onBlur={() => saveQuiz(activeChapter, quizIndex)}
                                            placeholder={`Option ${optIndex + 1}`}
                                            className="flex-1 h-8"
                                          />
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={() =>
                                              deleteOption(quizIndex, qIndex, optIndex)
                                            }
                                          >
                                            <X className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      ))}
                                    </RadioGroup>
                                  ) : (
                                    <div className="space-y-2">
                                      {question.options.map((option, optIndex) => (
                                        <div key={optIndex} className="flex items-center gap-2">
                                          <Checkbox
                                            checked={question.correctOptionIndexes.includes(
                                              optIndex
                                            )}
                                            onCheckedChange={() =>
                                              toggleCorrectAnswer(quizIndex, qIndex, optIndex)
                                            }
                                          />
                                          <Input
                                            value={option.text}
                                            onChange={(e) =>
                                              updateOption(
                                                quizIndex,
                                                qIndex,
                                                optIndex,
                                                e.target.value
                                              )
                                            }
                                            onBlur={() => saveQuiz(activeChapter, quizIndex)}
                                            placeholder={`Option ${optIndex + 1}`}
                                            className="flex-1 h-8"
                                          />
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={() =>
                                              deleteOption(quizIndex, qIndex, optIndex)
                                            }
                                          >
                                            <X className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => addOption(quizIndex, qIndex)}
                                    className="mt-1"
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Add Option
                                  </Button>
                                </div>
                              </div>
                            ))}
                            <Button
                              onClick={() => addQuestion(quizIndex)}
                              variant="outline"
                              size="sm"
                              className="w-full"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Question
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                      {courseData.chapters[activeChapter].quizzes.length === 0 && (
                        <Button
                          onClick={addQuiz}
                          variant="outline"
                          className="w-full"
                          disabled={isAddingQuiz || uploadingLessonIndex !== null || isAddingChapter}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          {isAddingQuiz ? 'Adding...' : 'Add Quiz'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div >
  );

  const renderAttachments = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Paperclip className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Attachments</h2>
          <p className="text-sm text-muted-foreground">Upload additional resources for your students</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload Resources</CardTitle>
            <CardDescription>Add PDFs, documents, or other materials</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`block ${isUploadingResources ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}>
              <input
                ref={resourcesInputRef}
                type="file"
                multiple
                className="hidden"
                disabled={isUploadingResources}
                onChange={(e) => e.target.files && handleResourceUpload(Array.from(e.target.files))}
              />
              <div
                className="border-2 border-dashed rounded-xl p-8 text-center hover:border-primary/50 transition-all cursor-pointer bg-gradient-to-br from-muted/20 to-muted/40"
                onClick={() => !isUploadingResources && resourcesInputRef.current?.click()}
              >
                <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-4">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <p className="font-medium">{isUploadingResources ? 'Uploading...' : 'Drop files here or click to browse'}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  PDF, DOC, DOCX, PPT, XLS up to 50MB each
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              Uploaded Resources
              {isUploadingResources && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </CardTitle>
            <CardDescription>
              {courseData.resources.length} file{courseData.resources.length !== 1 ? 's' : ''} uploaded
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {isUploadingResources && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-primary/20 animate-pulse">
                    <div className="p-2 rounded-lg bg-background">
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-primary">Uploading resources...</p>
                      <p className="text-xs text-muted-foreground">Please wait</p>
                    </div>
                  </div>
                )}
                {courseData.resources.length === 0 && !isUploadingResources ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No resources uploaded yet</p>
                  </div>
                ) : (
                  courseData.resources.map((resource, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="p-2 rounded-lg bg-background shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{resource.name}</p>
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline truncate"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{resource.url}</span>
                        </a>
                        <p className="text-xs text-muted-foreground">{formatFileSize(resource.sizeBytes)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive shrink-0"
                        onClick={() => deleteResource(index)}
                        disabled={isUploadingResources}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Settings className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground">Configure access and visibility options</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Learning Areas <span className="text-destructive">*</span>
            </CardTitle>
            <CardDescription>Select relevant learning areas (multiple allowed)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTags ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const isSelected = courseData.tags.includes(tag.slug);
                  return (
                    <Badge
                      key={tag._id}
                      variant={isSelected ? 'default' : 'outline'}
                      className={`cursor-pointer px-4 py-2 text-sm transition-all duration-200 ${isSelected ? 'hover:bg-primary/90' : 'hover:bg-muted'}`}
                      onClick={() => toggleCategory(tag.slug)}
                    >
                      {tag.name}
                    </Badge>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Visibility <span className="text-destructive">*</span>
            </CardTitle>
            <CardDescription>Choose who can see this course</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button
                variant={courseData.visibility === 'clinicians' ? 'default' : 'outline'}
                className="flex-1 h-auto py-3 transition-all duration-200"
                onClick={() => setCourseData({ ...courseData, visibility: 'clinicians' })}
              >
                Clinicians Only
              </Button>
              <Button
                variant={courseData.visibility === 'all' ? 'default' : 'outline'}
                className="flex-1 h-auto py-3 transition-all duration-200"
                onClick={() => setCourseData({ ...courseData, visibility: 'all' })}
              >
                All Users
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Access Level <span className="text-destructive">*</span>
            </CardTitle>
            <CardDescription>Set the subscription tier required for this course</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {['free', 'develop', 'master'].map((level) => {
                const isSelected = courseData.accessLevel === level;
                return (
                  <Button
                    key={level}
                    variant={isSelected ? 'default' : 'outline'}
                    className="flex-1 h-auto py-3 transition-all duration-200"
                    onClick={() =>
                      setCourseData({
                        ...courseData,
                        accessLevel: level as 'free' | 'develop' | 'master',
                      })
                    }
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderReview = () => {
    const totalLessons = courseData.chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);
    const totalQuizzes = courseData.chapters.reduce((sum, ch) => sum + ch.quizzes.length, 0);
    const totalQuestions = courseData.chapters.reduce(
      (sum, ch) => sum + ch.quizzes.reduce((qSum, q) => qSum + q.questions.length, 0),
      0
    );

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/10">
            <Eye className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Review & Publish</h2>
            <p className="text-sm text-muted-foreground">Review your course details before publishing</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="pt-6">
              <div className="flex gap-6">
                {courseData.thumbnailUrl && (
                  <div className="w-48 h-28 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={courseData.thumbnailUrl}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold truncate">{courseData.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {courseData.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {courseData.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="capitalize">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Course Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Chapters</span>
                  <Badge variant="outline">{courseData.chapters.length}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Lessons</span>
                  <Badge variant="outline">{totalLessons}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Quizzes</span>
                  <Badge variant="outline">{totalQuizzes}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Questions</span>
                  <Badge variant="outline">{totalQuestions}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Resources</span>
                  <Badge variant="outline">{courseData.resources.length}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Visibility</p>
                <Badge variant="secondary" className="capitalize">
                  {courseData.visibility === 'all' ? 'All Users' : 'Clinicians Only'}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Access Level</p>
                <Badge variant="secondary" className="capitalize">
                  {courseData.accessLevel}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Chapters Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-3">
                  {courseData.chapters.map((chapter, index) => (
                    <div
                      key={chapter._id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{chapter.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {chapter.lessons.length} lessons • {chapter.quizzes.length} quizzes
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4 bg-muted/30">
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold">Ready to publish?</h3>
                <p className="text-sm text-muted-foreground">
                  {rolePath === 'super-admin'
                    ? "Your course will be published directly"
                    : "Your course will be reviewed before going live"
                  }
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="min-w-[140px]"
                  onClick={() => handleSaveCourse(false)}
                  disabled={isSaving || isSubmitting || uploadingLessonIndex !== null}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {isSaving ? 'Saving...' : 'Save as Draft'}
                </Button>
                <Button
                  size="lg"
                  className="min-w-[160px]"
                  onClick={() => handleSaveCourse(true)}
                  disabled={isSaving || isSubmitting || uploadingLessonIndex !== null}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  {isSubmitting
                    ? (rolePath === 'super-admin' ? 'Publishing...' : 'Submitting...')
                    : (rolePath === 'super-admin' ? 'Publish Course' : 'Submit for Review')
                  }
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };


  const renderStep = () => {
    switch (step) {
      case 1:
        return renderCourseDetails();
      case 2:
        return renderChapters();
      case 3:
        return renderAttachments();
      case 4:
        return renderSettings();
      case 5:
        return renderReview();
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 h-full">
      <StepIndicator currentStep={step} onStepClick={goToStep} />

      <div className="flex-1 overflow-auto">{renderStep()}</div>

      <Dialog open={isVideoPreviewOpen} onOpenChange={setIsVideoPreviewOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <div className="p-6 pb-4">
            <DialogHeader>
              <DialogTitle className="truncate">
                {previewVideo?.lessonTitle || 'Video Preview'}
              </DialogTitle>
              <DialogDescription className="truncate">
                {previewVideo?.chapterTitle ? `${previewVideo.chapterTitle}` : ''}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 pb-6 space-y-3">
            <div className="relative w-full overflow-hidden rounded-lg border bg-black">
              <div className="w-full" style={{ paddingTop: '56.25%' }} />
              <div className="absolute inset-0">
                <video
                  key={previewVideo?.video.cloudinaryId || previewVideo?.video.cloudinaryUrl || 'video'}
                  className="h-full w-full"
                  controls
                  controlsList="nodownload"
                  autoPlay
                  crossOrigin="anonymous"
                >
                  {previewVideo?.video.cloudinaryId ? (
                    <source
                      src={getMp4PlaybackUrl(previewVideo.video.cloudinaryId)}
                      type="video/mp4"
                    />
                  ) : previewVideo?.video.cloudinaryUrl ? (
                    <source src={previewVideo.video.cloudinaryUrl} />
                  ) : null}
                  {(() => {
                    const tracks = (previewVideo?.video.subtitles || []).filter(
                      (t) => t.format === 'vtt' && typeof t.url === 'string' && t.url.length > 0
                    );
                    const hasDefault = tracks.some((t) => t.default);
                    return tracks.map((t, idx) => (
                      <track
                        key={`${t.lang}-${t.format}-${idx}`}
                        src={t.url}
                        kind="subtitles"
                        srcLang={t.lang}
                        label={t.label}
                        default={t.default || (!hasDefault && idx === 0)}
                      />
                    ));
                  })()}
                </video>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {previewVideo?.video.durationSeconds ? (
                  <Badge variant="secondary" className="bg-secondary/50 font-mono">
                    {formatDuration(previewVideo.video.durationSeconds)}
                  </Badge>
                ) : null}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setIsVideoPreviewOpen(false)}>
                Close
              </Button>
            </div>
            {/* Subtitle management — slim variant for dialogs */}
            {activeCourseId && previewVideo?.video.cloudinaryId && (
              <SubtitleStatusCard
                variant="slim"
                status={previewVideo.video.subtitle_status}
                failureReason={previewVideo.video.subtitle_failure_reason}
                retryCount={previewVideo.video.subtitle_retry_count}
                lastAttempt={previewVideo.video.last_subtitle_attempt}
                retryable={previewVideo.video.retryable}
                hasSubtitleUrl={previewVideo.video.subtitles?.some((s) => s.format === 'vtt')}
                isRetrying={retryCourseSubtitlesMutation.isPending}
                onRetry={() =>
                  handleRetryCourseSubtitles(
                    activeCourseId,
                    previewVideo.video.cloudinaryId!
                  )
                }
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative mt-2">
        <div className="absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        <div className="flex items-center justify-between py-4 px-1">
          <div>
            {step > 1 ? (
              <Button variant="outline" onClick={() => goToStep(step - 1)} className="gap-2">
                <ChevronLeft className="w-4 h-4" />
                Back
              </Button>
            ) : (
              <Button variant="ghost" onClick={handleCancel} className="text-muted-foreground hover:text-foreground">
                Cancel
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            {step < 5 && (
              <Button onClick={() => goToStep(step + 1)} className="gap-2 shadow-sm">
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
