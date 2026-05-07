import { apiClient } from "@/lib/api";

// ── Domain types ──────────────────────────────────────────────────────────────

export type ClinicianRole = "trainee" | "trainer";

export interface UserProfile {
    _id: string;
    userId: string;
    name: string;
    avatar: string;
    isDefault: boolean;
    createdAt: string;
}

export interface Clinician {
    clinicianId: string;
    clinicianRole: ClinicianRole;
    clinicianEmail: string;
    clinicianName: string;
}

export interface ClinicalAssignment {
    userId: string;
    profileId: string;
    clinicians: Clinician[];
}

export interface ClinicianUser {
    id: string;
    name: string;
    email: string;
    role: string;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface LearnerUser {
    id: string;
    name: string;
    email: string;
    role: string;
    emailVerified: boolean;
    banned?: boolean;
    accountType?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ListMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

export interface ListLearnersParams {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
}

export interface AssignClinicianPayload {
    userId: string;
    profileId?: string;
    clinicianId: string;
    clinicianRole: ClinicianRole;
    clinicianEmail: string;
    clinicianName: string;
}

export interface UnassignClinicianPayload {
    userId: string;
    profileId?: string;
    clinicianId: string;
    clinicianRole: ClinicianRole;
}

// ── API calls ─────────────────────────────────────────────────────────────────

/** Paginated list of Individual Learners (role: user) */
export async function listIndividualLearners(
    params: ListLearnersParams = {}
): Promise<{ users: LearnerUser[]; meta: ListMeta }> {
    const { data } = await apiClient.get("/admin/list-user/all", {
        params: {
            page: params.page ?? 1,
            limit: params.limit ?? 10,
            sortBy: params.sortBy ?? "createdAt",
            sortDirection: params.sortDirection ?? "asc",
            role: "user",
            field: "name",
            ...(params.search ? { search: params.search } : {}),
        },
    });
    return data.data;
}

/** All clinicians (trainee or trainer) for the select dropdown — full list */
export async function listCliniciansByRole(role: ClinicianRole): Promise<ClinicianUser[]> {
    const { data } = await apiClient.get("/admin/list-user/all", {
        params: { page: 1, limit: 1000, role },
    });
    const users = (data?.data?.users ?? []) as ClinicianUser[];
    return users.filter((u) => u.role === role);
}

/** Profiles belonging to an Individual Learner */
export async function fetchUserProfiles(userId: string): Promise<UserProfile[]> {
    const { data } = await apiClient.get("/admin/user-profiles", { params: { userId } });
    const result = data?.data;
    return Array.isArray(result) ? result : [result].filter(Boolean);
}

/** Current clinicians assigned to a learner for a specific profile */
export async function getAssignedClinicians(
    userId: string,
    profileId = ""
): Promise<ClinicalAssignment> {
    const { data } = await apiClient.get(`/assign-clinical/${userId}`, {
        params: profileId ? { profileId } : undefined,
    });
    return {
        userId: data?.data?.userId ?? userId,
        profileId: data?.data?.profileId ?? profileId,
        clinicians: data?.data?.clinicians ?? [],
    };
}

/** Assign or update a clinician on a learner */
export async function assignClinician(payload: AssignClinicianPayload): Promise<ClinicalAssignment> {
    const { data } = await apiClient.post("/assign-clinical/assign", payload);
    return data.data;
}

/** Remove a clinician from a learner */
export async function unassignClinician(payload: UnassignClinicianPayload): Promise<void> {
    await apiClient.delete("/assign-clinical/assign", { data: payload });
}
