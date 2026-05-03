import { apiClient } from '@/lib/api';

/**
 * Represents a Learning Area (Tag) entity as defined in the backend schema.
 */
export interface Tag {
    _id: string;
    name: string;
    slug: string;
    active: boolean;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * Represents a video resource embedded within a course lesson.
 */
export interface VideoSubtitle {
    lang: string;
    label: string;
    url: string;
    format: 'vtt' | 'srt';
    default?: boolean;
}

export interface VideoItem {
    cloudinaryUrl: string;
    cloudinaryId: string;
    durationSeconds: number;
    thumbnailUrl: string;
    subtitle_status?: 'pending' | 'processing' | 'completed' | 'failed';
    subtitle_failure_reason?: string | null;
    subtitle_retry_count?: number;
    last_subtitle_attempt?: string | null;
    retryable?: boolean;
    subtitles?: VideoSubtitle[];
}

/**
 * Defines the structure of a single educational unit (Lesson) contained within a Chapter.
 */
export interface Lesson {
    title: string;
    description: string;
    videos: VideoItem[];
}

/**
 * Represents a single selectable answer option within a Quiz Question.
 */
export interface QuestionOption {
    text: string;
}

/**
 * Defines the structure of a Quiz Question, supporting single or multiple choice formats.
 */
export interface Question {
    type: 'single' | 'multiple';
    prompt: string;
    options: QuestionOption[];
    correctOptionIndexes: number[];
}

/**
 * Represents an assessment unit (Quiz) contained within a Chapter.
 */
export interface Quiz {
    title: string;
    questions: Question[];
}

/**
 * Defines the structure of a Course Chapter, acting as a container for Lessons and Quizzes.
 */
export interface Chapter {
    _id?: string;
    title: string;
    lessons: Lesson[];
    quizzes: Quiz[];
}

/**
 * Represents a downloadable file attachment associated with a Course.
 */
export interface Resource {
    name: string;
    url: string;
    mimeType: string;
    sizeBytes: number;
}

/**
 * Enumeration of possible Course lifecyle states.
 */
export type CourseStatus = 'draft' | 'pending' | 'published';

/**
 * Enumeration of subscription tiers required to access the Course.
 */
export type AccessLevel = 'free' | 'develop' | 'master';

/**
 * Enumeration of target audience visibility settings.
 */
export type Visibility = 'clinicians' | 'all';

/**
 * Comprehensive data model representing a Course entity, including all nested relationships and metadata.
 */
export interface Course {
    _id?: string;
    title: string;
    description: string;
    thumbnailUrl?: string;
    tags: string[];
    visibility: Visibility;
    accessLevel: AccessLevel;
    status: CourseStatus;
    chapters: Chapter[];
    resources: Resource[];
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Standardized generic wrapper for all API responses, ensuring consistent error handling and data extraction.
 */
interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
}

/**
 * Retrieves the complete list of available Learning Areas (Tags) from the admin configuration.
 * @returns Promise resolving to an array of Tag objects.
 */
export async function getTags(): Promise<Tag[]> {
    const response = await apiClient.get<ApiResponse<Tag[]>>('/admin/tags');
    return response.data.data;
}

/**
 * Requests the deletion of a video asset from Cloudinary storage via the backend proxy.
 * @param publicId - The Cloudinary public ID of the asset.
 * @param resourceType - The type of resource (default: 'video').
 */
export async function deleteCloudinaryVideo(publicId: string, resourceType: string = 'video'): Promise<void> {
    await apiClient.post('/courses/delete-cloudinary-video', {
        publicId,
        resourceType
    });
}

/**
 * Initializes a new Course entity with basic metadata.
 * Handles multipart/form-data conversion for optional thumbnail uploads.
 * @param data - The initial course configuration payload.
 * @returns Promise resolving to the newly created Course object.
 */
export async function createCourse(data: {
    title: string;
    description: string;
    accessLevel: AccessLevel;
    tags: string;
    thumbnail?: File;
}): Promise<Course> {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('status', 'draft');
    formData.append('accessLevel', data.accessLevel);
    formData.append('tags', data.tags);
    if (data.thumbnail) {
        formData.append('thumbnail', data.thumbnail);
    }

    const response = await apiClient.post<ApiResponse<Course>>('/courses', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
}

/**
 * Retrieves full details for a specific Course by its unique identifier.
 * @param courseId - The unique database ID of the course.
 */
export async function getCourse(courseId: string): Promise<Course> {
    const response = await apiClient.get<ApiResponse<Course>>(`/courses/${courseId}`);
    return response.data.data;
}

/**
 * Updates existing course properties using a PATCH strategy.
 * Supports both JSON payloads and Multipart/Form-Data (when a thumbnail is involved).
 * 
 * Key Behavior:
 * - Arrays (tags) are serialized to comma-separated strings if required by the backend.
 * - Complex objects (chapters) are JSON-stringified when sent via FormData.
 */
export async function updateCourse(
    courseId: string,
    data: Partial<Pick<Course, 'title' | 'description' | 'tags' | 'visibility' | 'accessLevel' | 'chapters' | 'thumbnailUrl'>> & { thumbnail?: File }
): Promise<Course> {
    if (data.thumbnail) {
        const formData = new FormData();
        if (data.title) formData.append('title', data.title);
        if (data.description) formData.append('description', data.description);
        if (data.tags) formData.append('tags', Array.isArray(data.tags) ? data.tags.join(',') : data.tags);
        if (data.visibility) formData.append('visibility', data.visibility);
        if (data.accessLevel) formData.append('accessLevel', data.accessLevel);
        if (data.chapters) formData.append('chapters', JSON.stringify(data.chapters));
        formData.append('thumbnail', data.thumbnail);

        const response = await apiClient.patch<ApiResponse<Course>>(`/courses/${courseId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data.data;
    }

    // Normalize 'tags' array to a comma-separated string to match backend expectations for non-FormData requests.
    const payload: any = { ...data };
    if (payload.tags && Array.isArray(payload.tags)) {
        payload.tags = payload.tags.length > 0 ? payload.tags.join(',') : '';
    }

    const response = await apiClient.patch<ApiResponse<Course>>(`/courses/${courseId}`, payload);
    return response.data.data;
}

/**
 * Permanently removes a Course entity and its associated relations.
 */
export async function deleteCourse(courseId: string): Promise<void> {
    await apiClient.delete(`/courses/${courseId}`);
}

/**
 * Appends a new Chapter to the specified Course.
 */
export async function addChapter(courseId: string, title: string): Promise<Course> {
    const response = await apiClient.post<ApiResponse<Course>>(
        `/courses/${courseId}/chapters`,
        { title }
    );
    return response.data.data;
}

/**
 * Removes a Chapter from the Course at the specified index.
 */
export async function deleteChapter(courseId: string, chapterIndex: number): Promise<Course> {
    const response = await apiClient.delete<ApiResponse<Course>>(
        `/courses/${courseId}/chapters/${chapterIndex}`
    );
    return response.data.data;
}

/**
 * Appends a new Lesson to a specific Chapter within a Course.
 */
export async function addLesson(
    courseId: string,
    chapterIndex: number,
    lesson: Lesson
): Promise<Course> {
    const response = await apiClient.post<ApiResponse<Course>>(
        `/courses/${courseId}/chapters/${chapterIndex}/lessons`,
        lesson
    );
    return response.data.data;
}

/**
 * Removes a Lesson from a Chapter based on its positional index.
 */
export async function deleteLesson(
    courseId: string,
    chapterIndex: number,
    lessonIndex: number
): Promise<Course> {
    const response = await apiClient.delete<ApiResponse<Course>>(
        `/courses/${courseId}/chapters/${chapterIndex}/lessons/${lessonIndex}`
    );
    return response.data.data;
}

/**
 * Updates the content of an existing Lesson.
 */
export async function updateLesson(
    courseId: string,
    chapterIndex: number,
    lessonIndex: number,
    lesson: Lesson
): Promise<Course> {
    const response = await apiClient.post<ApiResponse<Course>>(
        `/courses/${courseId}/chapters/${chapterIndex}/lessons/${lessonIndex}`,
        lesson
    );
    return response.data.data;
}

/**
 * Removes a Video from a Lesson based on its positional index.
 * Handles both database reference removal and Cloudinary asset deletion.
 */
export async function deleteLessonVideo(
    courseId: string,
    chapterIndex: number,
    lessonIndex: number,
    videoIndex: number
): Promise<Course> {
    const response = await apiClient.delete<ApiResponse<Course>>(
        `/courses/${courseId}/chapters/${chapterIndex}/lessons/${lessonIndex}/videos/${videoIndex}`
    );
    return response.data.data;
}

/**
 * Appends a new Quiz to a specific Chapter within a Course.
 */
export async function addQuiz(
    courseId: string,
    chapterIndex: number,
    quiz: Quiz
): Promise<Course> {
    const response = await apiClient.post<ApiResponse<Course>>(
        `/courses/${courseId}/chapters/${chapterIndex}/quizzes`,
        quiz
    );
    return response.data.data;
}

/**
 * Removes a Quiz from a Chapter based on its positional index.
 */
export async function deleteQuiz(
    courseId: string,
    chapterIndex: number,
    quizIndex: number
): Promise<Course> {
    const response = await apiClient.delete<ApiResponse<Course>>(
        `/courses/${courseId}/chapters/${chapterIndex}/quizzes/${quizIndex}`
    );
    return response.data.data;
}

/**
 * Updates an existing Quiz in a Chapter.
 * Uses the POST endpoint which handles upsert (updates if quiz exists).
 */
export async function updateQuiz(
    courseId: string,
    chapterIndex: number,
    quiz: Quiz
): Promise<Course> {
    const response = await apiClient.post<ApiResponse<Course>>(
        `/courses/${courseId}/chapters/${chapterIndex}/quizzes`,
        quiz
    );
    return response.data.data;
}

/**
 * Updates or adds a video to a specific lesson.
 * Uses PATCH to upsert the first video for the given lesson.
 */
export async function updateLessonVideo(
    courseId: string,
    chapterIndex: number,
    lessonIndex: number,
    videoData: {
        cloudinaryUrl: string;
        cloudinaryId: string;
        durationSeconds?: number;
        thumbnailUrl?: string;
        title?: string;
        description?: string;
    }
): Promise<Course> {
    const response = await apiClient.patch<ApiResponse<Course>>(
        `/courses/${courseId}/chapters/${chapterIndex}/lessons/${lessonIndex}/video`,
        videoData
    );
    return response.data.data;
}

/**
 * Uploads multiple resource files (attachments) to a specific Course.
 * Uses FormData to handle concurrent file streams.
 */
export async function uploadResources(courseId: string, files: File[]): Promise<Course> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const response = await apiClient.post<ApiResponse<Course>>(
        `/courses/${courseId}/resources/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data;
}

/**
 * Removes a specific resource attachment from a Course based on its index.
 */
export async function deleteResource(courseId: string, resourceIndex: number): Promise<Course> {
    const response = await apiClient.delete<ApiResponse<Course>>(
        `/courses/${courseId}/resources/${resourceIndex}`
    );
    return response.data.data;
}

/**
 * Updates the lifecycle status of a Course (e.g., Draft -> Published).
 * Note: Restricted to Admin users for 'published' state transitions.
 */
export async function changeStatus(courseId: string, status: CourseStatus): Promise<Course> {
    const response = await apiClient.put<ApiResponse<Course>>(
        `/admin/change-status-course/${courseId}`,
        { status }
    );
    return response.data.data;
}

/**
 * Triggers subtitle regeneration for a specific course video.
 * @param courseId - The course's database ID.
 * @param cloudinaryId - The specific video's Cloudinary public ID to retry.
 */
export async function retryCourseSubtitles(courseId: string, cloudinaryId: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ success: boolean; message: string; data: unknown }>(
        `/courses/${courseId}/retry-subtitles?cloudinaryId=${encodeURIComponent(cloudinaryId)}`
    );
    return { message: response.data.message };
}
