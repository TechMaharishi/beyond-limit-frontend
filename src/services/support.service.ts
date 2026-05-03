import { apiClient } from '@/lib/api';

/**
 * Represents a ticket type/category.
 */
export interface TicketType {
    _id: string;
    name: string;
    slug: string;
    description: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

/**
 * Represents a user who created a ticket.
 */
export interface TicketUser {
    _id: string;
    name: string;
    email: string;
}

/**
 * Represents a Support Ticket.
 */
export interface Ticket {
    _id: string;
    user: TicketUser;
    subject: string;
    type: string;
    description: string;
    currentStatus: 'pending' | 'resolved';
    userId: string;
    imageUrl?: string;
    imageCloudinaryId?: string;
    imageUrls?: string[];
    imageCloudinaryIds?: string[];
    videoUrls?: string[];
    videoCloudinaryIds?: string[];
    resolvedBy?: string;
    resolvedAt?: string;
    expireAt?: string;
    resolutionMsg?: string;
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
    meta?: {
        page: number;
        offset?: number;
        limit: number;
        total: number;
        hasNext: boolean;
    };
}

/**
 * Payload for creating a new support ticket.
 */
export interface CreateTicketPayload {
    subject: string;
    type: string;
    description: string;
    images?: File[];
    videos?: File[];
}

/**
 * Retrieves all available ticket types.
 */
export async function getTicketTypes(): Promise<TicketType[]> {
    const response = await apiClient.get<ApiResponse<TicketType[]>>('/support/ticket-types');
    return response.data.data;
}

/**
 * Creates a new support ticket with optional image and video attachments.
 * @param data - The ticket creation payload.
 */
export async function createTicket(data: CreateTicketPayload): Promise<void> {
    const formData = new FormData();
    formData.append('subject', data.subject);
    formData.append('type', data.type);
    formData.append('description', data.description);

    data.images?.forEach((image) => {
        formData.append('images', image);
    });

    data.videos?.forEach((video) => {
        formData.append('videos', video);
    });

    await apiClient.post('/support/tickets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
}

/**
 * Retrieves tickets filtered by type slug.
 * @param typeSlug - The slug of the ticket type (e.g., 'app-technical-support').
 * @param page - Page number for pagination.
 * @param limit - Number of items per page.
 */
export async function getTicketsByType(typeSlug: string, page = 1, limit = 20): Promise<{ data: Ticket[], meta: ApiResponse<Ticket[]>['meta'] }> {
    const response = await apiClient.get<ApiResponse<Ticket[]>>(`/support/tickets/${typeSlug}`, {
        params: { page, limit }
    });
    return { data: response.data.data, meta: response.data.meta };
}

export async function getTickets(page = 1, limit = 20): Promise<{ data: Ticket[], meta: ApiResponse<Ticket[]>['meta'] }> {
    const response = await apiClient.get<ApiResponse<Ticket[]>>('/support/tickets', {
        params: { page, limit }
    });
    return { data: response.data.data, meta: response.data.meta };
}
