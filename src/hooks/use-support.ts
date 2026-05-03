import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
    getTicketTypes,
    createTicket,
    getTicketsByType,
    getTickets,
    type CreateTicketPayload,
} from '@/services/support.service';

/**
 * React Query key factory for support tickets management.
 */
export const supportKeys = {
    all: ['support'] as const,
    ticketTypes: () => [...supportKeys.all, 'ticket-types'] as const,
    ticketsByType: (typeSlug: string) => [...supportKeys.all, 'tickets-by-type', typeSlug] as const,
    tickets: () => [...supportKeys.all, 'tickets'] as const,
};

/**
 * Retrieves all available ticket types.
 */
export function useTicketTypes() {
    return useQuery({
        queryKey: supportKeys.ticketTypes(),
        queryFn: getTicketTypes,
    });
}

/**
 * Retrieves tickets filtered by type.
 */
export function useTicketsByType(typeSlug: string, page = 1, limit = 20) {
    return useQuery({
        queryKey: [...supportKeys.ticketsByType(typeSlug), page, limit],
        queryFn: () => getTicketsByType(typeSlug, page, limit),
        placeholderData: keepPreviousData,
    });
}

export function useTickets(page = 1, limit = 20) {
    return useQuery({
        queryKey: [...supportKeys.tickets(), page, limit],
        queryFn: () => getTickets(page, limit),
        placeholderData: keepPreviousData,
    });
}

/**
 * Creates a new support ticket.
 * Invalidates the tickets list query on success.
 */
export function useCreateTicket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateTicketPayload) => createTicket(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets'] });
            queryClient.invalidateQueries({ queryKey: supportKeys.all });
        },
    });
}
