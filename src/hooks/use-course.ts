import {
    useQuery,
    useMutation,
    useQueryClient
} from '@tanstack/react-query';
import {
    getTags,
    createCourse,
    getCourse,
    updateCourse,
    deleteCourse,
    addChapter,
    deleteChapter,
    addLesson,
    updateLesson,
    deleteLesson,
    addQuiz,
    updateQuiz,
    deleteQuiz,
    updateLessonVideo,
    deleteLessonVideo,
    uploadResources,
    deleteResource,
    changeStatus,
    deleteCloudinaryVideo,
    retryCourseSubtitles,
    type Tag,
    type Course,
    type AccessLevel,
    type CourseStatus,
    type Lesson,
    type Quiz
} from '@/services/course.service';

/**
 * React Query key factory for course management.
 * Centralizes cache key logic to ensure consistency across queries and invalidations.
 */
export const courseKeys = {
    all: ['courses'] as const,
    lists: () => [...courseKeys.all, 'list'] as const,
    detail: (id: string) => [...courseKeys.all, 'detail', id] as const,
    tags: ['tags'] as const,
};

/**
 * Fetches available learning areas (tags) for course categorization.
 * Data is cached for 5 minutes to reduce server load for static reference data.
 */
export function useTags() {
    return useQuery<Tag[], Error>({
        queryKey: courseKeys.tags,
        queryFn: getTags,
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Handles deletion of video assets from Cloudinary.
 * Used for cleaning up orphaned resources or replacing video content.
 */
export function useDeleteCloudinaryVideo() {
    return useMutation({
        mutationFn: ({ publicId, resourceType }: { publicId: string; resourceType?: string }) =>
            deleteCloudinaryVideo(publicId, resourceType),
    });
}

/**
 * Retrieves detailed information for a specific course.
 * Enabled only when a valid courseId is provided to prevent unnecessary requests.
 */
export function useCourse(courseId: string | undefined) {
    return useQuery<Course, Error>({
        queryKey: courseKeys.detail(courseId!),
        queryFn: () => getCourse(courseId!),
        enabled: !!courseId,
    });
}

/**
 * Creates a new course entity.
 * Invalidates the course list query on success to reflect the new entry immediately.
 */
export function useCreateCourse() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: {
            title: string;
            description: string;
            accessLevel: AccessLevel;
            tags: string;
            thumbnail?: File;
        }) => createCourse(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: courseKeys.lists() });
        },
    });
}

/**
 * Updates an existing course's metadata and structure.
 * Invalidates both specific course details and the general list to ensure data consistency.
 */
export function useUpdateCourse() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            courseId,
            data,
        }: {
            courseId: string;
            data: Partial<Pick<Course, 'title' | 'description' | 'tags' | 'visibility' | 'accessLevel' | 'chapters' | 'thumbnailUrl'>> & { thumbnail?: File };
        }) => updateCourse(courseId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: courseKeys.detail(variables.courseId) });
            queryClient.invalidateQueries({ queryKey: courseKeys.lists() });
        },
    });
}

/**
 * Permanently deletes a course.
 * Triggers a refresh of the course list upon successful deletion.
 */
export function useDeleteCourse() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (courseId: string) => deleteCourse(courseId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: courseKeys.lists() });
        },
    });
}

/**
 * Appends a new chapter to the specified course.
 * Refreshes course details to display the newly added chapter.
 */
export function useAddChapter() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ courseId, title }: { courseId: string; title: string }) =>
            addChapter(courseId, title),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: courseKeys.detail(variables.courseId) });
        },
    });
}

/**
 * Removes a chapter from a course by its index.
 * Updates the local cache to reflect the structural change.
 */
export function useDeleteChapter() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ courseId, chapterIndex }: { courseId: string; chapterIndex: number }) =>
            deleteChapter(courseId, chapterIndex),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: courseKeys.detail(variables.courseId) });
        },
    });
}

/**
 * Adds a new lesson to a specific chapter.
 * Triggers a re-fetch of course details to ensure the lesson list is up-to-date.
 */
export function useAddLesson() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            courseId,
            chapterIndex,
            lesson,
        }: {
            courseId: string;
            chapterIndex: number;
            lesson: Lesson;
        }) => addLesson(courseId, chapterIndex, lesson),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: courseKeys.detail(variables.courseId) });
        },
    });
}

/**
 * Modifies an existing lesson's content or metadata.
 * Ensures the UI reflects the latest lesson state by invalidating the course query.
 */
export function useUpdateLesson() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            courseId,
            chapterIndex,
            lessonIndex,
            lesson,
        }: {
            courseId: string;
            chapterIndex: number;
            lessonIndex: number;
            lesson: Lesson;
        }) => updateLesson(courseId, chapterIndex, lessonIndex, lesson),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: courseKeys.detail(variables.courseId) });
        },
    });
}

/**
 * Attaches a quiz to a specific chapter.
 * Updates the course structure in the cache upon success.
 */
export function useAddQuiz() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            courseId,
            chapterIndex,
            quiz,
        }: {
            courseId: string;
            chapterIndex: number;
            quiz: Quiz;
        }) => addQuiz(courseId, chapterIndex, quiz),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: courseKeys.detail(variables.courseId) });
        },
    });
}

/**
 * Removes a quiz from a chapter by its index.
 * Refreshes course data to prevent interaction with deleted content.
 */
export function useDeleteQuiz() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            courseId,
            chapterIndex,
            quizIndex,
        }: {
            courseId: string;
            chapterIndex: number;
            quizIndex: number;
        }) => deleteQuiz(courseId, chapterIndex, quizIndex),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: courseKeys.detail(variables.courseId) });
        },
    });
}

/**
 * Updates an existing quiz with new content (title, questions).
 * Used to sync local quiz changes to the backend.
 */
export function useUpdateQuiz() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            courseId,
            chapterIndex,
            quiz,
        }: {
            courseId: string;
            chapterIndex: number;
            quiz: Quiz;
        }) => updateQuiz(courseId, chapterIndex, quiz),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: courseKeys.detail(variables.courseId) });
        },
    });
}

/**
 * Updates or adds a video to a specific lesson.
 * Used after uploading video to Cloudinary to sync with backend.
 */
export function useUpdateLessonVideo() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            courseId,
            chapterIndex,
            lessonIndex,
            videoData,
        }: {
            courseId: string;
            chapterIndex: number;
            lessonIndex: number;
            videoData: {
                cloudinaryUrl: string;
                cloudinaryId: string;
                durationSeconds?: number;
                thumbnailUrl?: string;
            };
        }) => updateLessonVideo(courseId, chapterIndex, lessonIndex, videoData),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: courseKeys.detail(variables.courseId) });
        },
    });
}

/**
 * Removes a video from a lesson.
 * Triggers backend cleanup (DB + Cloudinary) and refreshes course data.
 */
export function useDeleteLessonVideo() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            courseId,
            chapterIndex,
            lessonIndex,
            videoIndex,
        }: {
            courseId: string;
            chapterIndex: number;
            lessonIndex: number;
            videoIndex: number;
        }) => deleteLessonVideo(courseId, chapterIndex, lessonIndex, videoIndex),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: courseKeys.detail(variables.courseId) });
        },
    });
}

/**
 * Removes a lesson from a chapter.
 * Refreshes course data to prevent interaction with deleted content.
 */
export function useDeleteLesson() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            courseId,
            chapterIndex,
            lessonIndex,
        }: {
            courseId: string;
            chapterIndex: number;
            lessonIndex: number;
        }) => deleteLesson(courseId, chapterIndex, lessonIndex),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: courseKeys.detail(variables.courseId) });
        },
    });
}

/**
 * Handles batch upload of resource files to a course.
 * Invalidates cache to display newly uploaded resources immediately.
 */
export function useUploadResources() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ courseId, files }: { courseId: string; files: File[] }) =>
            uploadResources(courseId, files),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: courseKeys.detail(variables.courseId) });
        },
    });
}

/**
 * Deletes a specific resource file from a course.
 * Ensures the resource list is accurate by refreshing course details.
 */
export function useDeleteResource() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ courseId, resourceIndex }: { courseId: string; resourceIndex: number }) =>
            deleteResource(courseId, resourceIndex),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: courseKeys.detail(variables.courseId) });
        },
    });
}

/**
 * Updates the publication status of a course (e.g., Draft, Published).
 * Invalidates both detail and list views to ensure status visibility is consistent across the app.
 */
export function useChangeStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ courseId, status }: { courseId: string; status: CourseStatus }) =>
            changeStatus(courseId, status),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: courseKeys.detail(variables.courseId) });
            queryClient.invalidateQueries({ queryKey: courseKeys.lists() });
        },
    });
}

/**
 * Triggers subtitle regeneration for a specific lesson video within a course.
 * Invalidates the course detail cache so the updated status is reflected immediately.
 */
export function useRetryCourseSubtitles() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ courseId, cloudinaryId }: { courseId: string; cloudinaryId: string }) =>
            retryCourseSubtitles(courseId, cloudinaryId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: courseKeys.detail(variables.courseId) });
        },
    });
}
