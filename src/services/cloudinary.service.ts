import axios from 'axios';

const CLOUD_NAME = 'drqacxq8d';
const UPLOAD_PRESET_COURSES = 'course-videos';
const UPLOAD_PRESET_SHORTS = 'short-videos';
// Recommended chunk size for optimal upload performance (20MB)
const CHUNK_SIZE = 20 * 1024 * 1024;

/**
 * Generates a unique identifier for chunked upload sessions to ensure integrity.
 * This ID is sent via headers to link separate chunks to the same upload transaction.
 */
function generateUniqueUploadId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Represents the standardized metadata returned after a successful video upload to Cloudinary.
 */
export interface CloudinaryVideoResult {
    cloudinaryUrl: string;
    cloudinaryId: string;
    thumbnailUrl: string;
    durationSeconds: number;
}

type CloudinaryUploadResponse = {
    secure_url: string;
    public_id: string;
    duration: number;
};

/**
 * Orchestrates video uploads to Cloudinary by selecting the appropriate method based on file size.
 * 
 * Strategy:
 * - Files < 50MB: Uses direct single-request upload for lower latency.
 * - Files >= 50MB: Uses chunked upload for reliability and to avoid timeout limits.
 * 
 * @param file - The video file object to be uploaded.
 * @param onProgress - Optional callback to track upload percentage (0-100).
 * @returns Promise resolving to the standardized Cloudinary video metadata.
 * @throws Error if the file is missing or invalid.
 */
export async function uploadVideo(
    file: File,
    onProgress?: (percent: number) => void
): Promise<CloudinaryVideoResult> {
    if (!file) throw new Error('No file provided');
    if (!file.type.startsWith('video/')) throw new Error('Invalid file type');

    // Select direct upload for smaller files to reduce overhead.
    if (file.size < 50 * 1024 * 1024) {
        return uploadDirectVideo(file, onProgress);
    } else {
        return uploadChunkedVideo(file, onProgress);
    }
}

/**
 * @deprecated Replaced by the smart 'uploadVideo' function which handles size detection automatically.
 * Kept for backward compatibility.
 */
export const uploadLargeVideo = uploadVideo;

/**
 * Performs a single-request upload for smaller video files.
 * Utilizes Axios to track upload progress events accurately.
 */
async function uploadDirectVideo(
    file: File,
    onProgress?: (percent: number) => void,
    preset: string = UPLOAD_PRESET_COURSES
): Promise<CloudinaryVideoResult> {
    if (!preset) throw new Error('Upload preset is required');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', preset);

    const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
        formData,
        {
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percent);
                }
            }
        }
    );

    const result = response.data as CloudinaryUploadResponse;
    return processCloudinaryResult(result);
}

/**
 * Handles large file uploads by splitting the file into 6MB chunks.
 * Uploads sequentially to ensure order and reliability, reporting progress as each chunk completes.
 * 
 * Note: Uses the native 'fetch' API for granular control over headers per chunk.
 */
async function uploadChunkedVideo(
    file: File,
    onProgress?: (percent: number) => void,
    preset: string = UPLOAD_PRESET_COURSES
): Promise<CloudinaryVideoResult> {
    if (!preset) throw new Error('Upload preset is required');
    const uploadId = generateUniqueUploadId();
    const totalSize = file.size;
    let start = 0;
    let chunkIndex = 0;
    let result: CloudinaryUploadResponse | null = null;

    while (start < totalSize) {
        const end = Math.min(start + CHUNK_SIZE, totalSize);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('file', chunk);
        formData.append('upload_preset', preset);

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
            {
                method: 'POST',
                headers: {
                    'X-Unique-Upload-Id': uploadId,
                    'Content-Range': `bytes ${start}-${end - 1}/${totalSize}`,
                },
                body: formData,
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed for chunk ${chunkIndex}: ${errorText}`);
        }

        result = (await response.json()) as CloudinaryUploadResponse;
        start = end;
        chunkIndex++;

        if (typeof onProgress === 'function') {
            const percent = Math.round((start / totalSize) * 100);
            onProgress(percent);
        }
    }

    if (!result) {
        throw new Error('Upload completed but no result received');
    }

    return processCloudinaryResult(result);
}

/**
 * Normalizes the raw Cloudinary API response into the application's internal data structure.
 * Also generates a default thumbnail URL using Cloudinary's on-the-fly transformation API.
 */
function processCloudinaryResult(result: CloudinaryUploadResponse): CloudinaryVideoResult {
    // Generate thumbnail URL from Cloudinary video URL
    const thumbnailUrl = result.secure_url.replace(
        '/video/upload/',
        '/video/upload/so_1/c_thumb,w_400,h_225/'
    ).replace(/\.[^.]+$/, '.jpg');

    return {
        cloudinaryUrl: result.secure_url,
        cloudinaryId: result.public_id,
        thumbnailUrl,
        durationSeconds: result.duration,
    };
}

/**
 * Uploads short video files to Cloudinary using the short-videos preset.
 * Uses the same size-based routing strategy as course videos.
 * 
 * @param file - The video file object to be uploaded.
 * @param onProgress - Optional callback to track upload percentage (0-100).
 * @returns Promise resolving to the standardized Cloudinary video metadata.
 * @throws Error if the file is missing or invalid.
 */
export async function uploadShortVideo(
    file: File,
    onProgress?: (percent: number) => void
): Promise<CloudinaryVideoResult> {
    if (!file) throw new Error('No file provided');
    if (!file.type.startsWith('video/')) throw new Error('Invalid file type');

    // Select direct upload for smaller files to reduce overhead.
    if (file.size < 50 * 1024 * 1024) {
        return uploadDirectVideo(file, onProgress, UPLOAD_PRESET_SHORTS);
    } else {
        return uploadChunkedVideo(file, onProgress, UPLOAD_PRESET_SHORTS);
    }
}

export function getSubtitleUrls(publicId: string) {
    const base = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${publicId}`;
    return {
        vtt: `${base}.vtt`,
        srt: `${base}.srt`,
    };
}

export function getVideoUrlWithBurnedSubtitles(
    publicId: string,
    opts?: {
        format?: 'vtt' | 'srt';
        color?: string;
        size?: number;
        position?: 'north' | 'south' | 'east' | 'west' | 'north_east' | 'north_west' | 'south_east' | 'south_west' | 'center';
    }
) {
    const format = opts?.format ?? 'vtt';
    const escapedPublicId = publicId.replace(/\//g, ':');
    const overlay = `l_subtitles:${escapedPublicId}.${format}`;
    const parts: string[] = [overlay];
    if (opts?.position) parts.push(`g_${opts.position}`);
    if (opts?.color) parts.push(`co_${opts.color}`);
    if (opts?.size) parts.push(`h_${opts.size}`);
    const transformation = parts.join(',');
    return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/${transformation}/${publicId}.mp4`;
}

export function getMp4PlaybackUrl(publicId: string) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/f_mp4,vc_h264,ac_aac/${publicId}.mp4`;
}
