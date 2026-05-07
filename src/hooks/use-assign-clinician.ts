import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    listIndividualLearners,
    listCliniciansByRole,
    fetchUserProfiles,
    getAssignedClinicians,
    assignClinician,
    unassignClinician,
    type ClinicianRole,
    type ListLearnersParams,
    type AssignClinicianPayload,
    type UnassignClinicianPayload,
} from "@/services/assign-clinician.service";

export const clinicianAssignKeys = {
    all: ["clinician-assign"] as const,
    learners: (params?: ListLearnersParams) =>
        [...clinicianAssignKeys.all, "learners", params] as const,
    cliniciansByRole: (role: ClinicianRole) =>
        [...clinicianAssignKeys.all, "by-role", role] as const,
    profiles: (userId: string) =>
        [...clinicianAssignKeys.all, "profiles", userId] as const,
    assigned: (userId: string, profileId: string) =>
        [...clinicianAssignKeys.all, "assigned", userId, profileId] as const,
};

export function useIndividualLearners(params?: ListLearnersParams) {
    return useQuery({
        queryKey: clinicianAssignKeys.learners(params),
        queryFn: () => listIndividualLearners(params),
    });
}

export function useCliniciansByRole(role: ClinicianRole) {
    return useQuery({
        queryKey: clinicianAssignKeys.cliniciansByRole(role),
        queryFn: () => listCliniciansByRole(role),
        staleTime: 5 * 60 * 1000,
    });
}

export function useUserProfiles(userId: string | null) {
    return useQuery({
        queryKey: clinicianAssignKeys.profiles(userId ?? ""),
        queryFn: () => fetchUserProfiles(userId!),
        enabled: !!userId,
        staleTime: 2 * 60 * 1000,
    });
}

export function useAssignedClinicians(
    userId: string | null,
    profileId: string,
    enabled = true
) {
    return useQuery({
        queryKey: clinicianAssignKeys.assigned(userId ?? "", profileId),
        queryFn: () => getAssignedClinicians(userId!, profileId),
        enabled: !!userId && enabled,
        staleTime: 60 * 1000,
    });
}

export function useAssignClinician() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: AssignClinicianPayload) => assignClinician(payload),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: clinicianAssignKeys.learners() });
            queryClient.invalidateQueries({
                queryKey: clinicianAssignKeys.assigned(
                    variables.userId,
                    variables.profileId ?? ""
                ),
            });
        },
    });
}

export function useUnassignClinician() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: UnassignClinicianPayload) => unassignClinician(payload),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: clinicianAssignKeys.learners() });
            queryClient.invalidateQueries({
                queryKey: clinicianAssignKeys.assigned(
                    variables.userId,
                    variables.profileId ?? ""
                ),
            });
        },
    });
}
