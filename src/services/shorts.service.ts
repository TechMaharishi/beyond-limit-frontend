import { apiClient } from '@/lib/api';

/**
 * Represents a Short Video creator/author.
 */
export interface ShortVideoUser {
    _id: string;
    name: string;
    email: string;
}

/**
 * Enumeration of possible Short Video lifecycle states.
 */
export type ShortVideoStatus = 'draft' | 'pending' | 'published' | 'rejected';

/**
 * Enumeration of subscription tiers required to access the Short Video.
 */
export type AccessLevel = 'free' | 'develop' | 'master';

/**
 * Enumeration of target audience visibility settings.
 */
export type Visibility = 'clinicians' | 'all';

/**
 * Comprehensive data model representing a Short Video entity.
 */
export interface ShortVideo {
    _id: string;
    title: string;
    description: string;
    tags: string[];
    status: ShortVideoStatus;
    rejectReason?: string;
    user: string;
    createdBy: ShortVideoUser;
    cloudinaryUrl: string;
    cloudinaryId: string;
    thumbnailUrl: string;
    accessLevel: AccessLevel;
    visibility: Visibility;
    durationSeconds: number;
    subtitles?: Array<{
        lang: string;
        label: string;
        url: string;
        format: 'vtt' | 'srt';
        default?: boolean;
    }>;
    /** Subtitle pipeline tracking fields */
    subtitle_status?: 'pending' | 'processing' | 'completed' | 'failed';
    subtitle_failure_reason?: string | null;
    subtitle_retry_count?: number;
    last_subtitle_attempt?: string | null;
    retryable?: boolean;
    createdAt: string;
    updatedAt: string;
}

/**
 * Standardized generic wrapper for all API responses.
 */
interface ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
}

/**
 * Payload for creating a new short video.
 */
export interface CreateShortPayload {
    title: string;
    description: string;
    tags: string[];
    accessLevel: AccessLevel;
    visibility: Visibility;
    cloudinaryUrl: string;
    cloudinaryId: string;
    thumbnailUrl: string;
    durationSeconds: number;
    status?: ShortVideoStatus;
}

/**
 * Payload for updating an existing short video.
 * All fields are optional for partial updates.
 */
export interface UpdateShortPayload {
    title?: string;
    description?: string;
    tags?: string[];
    accessLevel?: AccessLevel;
    visibility?: Visibility;
    cloudinaryUrl?: string;
    cloudinaryId?: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
    status?: ShortVideoStatus;
}

/**
 * Creates a new Short Video entity.
 * @param data - The short video creation payload.
 * @returns Promise resolving to the newly created ShortVideo object.
 */
export async function createShort(data: CreateShortPayload): Promise<ShortVideo> {
    const response = await apiClient.post<ApiResponse<ShortVideo>>('/short-videos', data);
    return response.data.data;
}

/**
 * Retrieves full details for a specific Short Video by its unique identifier.
 * @param shortId - The unique database ID of the short video.
 */
export async function getShort(shortId: string): Promise<ShortVideo> {
    const response = await apiClient.get<ApiResponse<ShortVideo>>(`/short-videos/${shortId}`);
    return response.data.data;
}

/**
 * Updates existing short video properties using a PUT strategy.
 * Supports partial updates - all fields are optional.
 * @param shortId - The unique database ID of the short video.
 * @param data - The partial update payload.
 */
export async function updateShort(shortId: string, data: UpdateShortPayload): Promise<ShortVideo> {
    const response = await apiClient.put<ApiResponse<ShortVideo>>(`/short-videos/${shortId}`, data);
    return response.data.data;
}

/**
 * Permanently removes a Short Video entity.
 * @param shortId - The unique database ID of the short video.
 */
export async function deleteShort(shortId: string): Promise<void> {
    await apiClient.delete(`/short-videos/${shortId}`);
}

/**
 * Deletes the video associated with a Short Video.
 * Clears video-related fields and progress while preserving metadata.
 * @param shortId - The unique database ID of the short video.
 */
export async function deleteShortVideo(shortId: string): Promise<void> {
    await apiClient.delete(`/short-videos/${shortId}/video`);
}

/**
 * Updates the lifecycle status of a Short Video (e.g., Draft -> Published).
 * Note: Restricted to Admin users for 'published' state transitions.
 * @param shortId - The unique database ID of the short video.
 * @param status - The new status to set.
 */
export async function changeShortStatus(shortId: string, status: ShortVideoStatus): Promise<ShortVideo> {
    const response = await apiClient.put<ApiResponse<ShortVideo>>(
        `/admin/change-status-short-video/${shortId}`,
        { status }
    );
    return response.data.data;
}

/**
 * Triggers a subtitle regeneration job for a short video.
 * @param shortId - The unique database ID of the short video.
 */
export async function retrySubtitles(shortId: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ success: boolean; message: string; data: unknown }>(
        `/short-videos/${shortId}/retry-subtitles`
    );
    return { message: response.data.message };
}
