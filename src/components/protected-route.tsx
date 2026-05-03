import { authClient } from "@/lib/auth-client"
import { Navigate, Outlet, useParams, useLocation } from "react-router-dom"
import { PageLoader } from "./page-loader"
import { getRolePath, getRoleHomePath } from "@/lib/utils"
import type { ReactNode } from "react"

/**
 * Higher-order component for route protection.
 * Handles:
 * 1. Session check: Redirects to login if unauthenticated.
 * 2. Role enforcement: Redirects to the correct role path if URL mismatch detects (e.g., user accessing admin routes).
 * 3. Loading state: Shows PageLoader while session is resolving.
 */
export function ProtectedRoute({ children }: { children?: ReactNode }) {
    const { data: session, isPending } = authClient.useSession()
    const params = useParams();
    const location = useLocation();

    if (isPending && !session) {
        return <PageLoader />
    }

    if (!session) {
        return <Navigate to="/login" />
    }

    // Determine the correct role path for the current user.
    const rolePath = getRolePath((session.user as any).role || "user");
    const currentRolePath = params.rolePath;
    const role = (session.user as any).role || "user";

    // Enforce role-based routing: if the URL path segment doesn't match the user's role, redirect.
    if (currentRolePath && currentRolePath !== rolePath) {
        const newPath = location.pathname.replace(`/${currentRolePath}`, `/${rolePath}`);
        return <Navigate to={newPath} replace />
    }

    // Clinical Learners should not access the dashboard; redirect them to Shorts.
    if (role === "trainee") {
        const dashboardPath = `/${rolePath}/dashboard`;
        if (location.pathname.startsWith(dashboardPath)) {
            return <Navigate to={getRoleHomePath(role)} replace />
        }
    }

    return children ? <>{children}</> : <Outlet />
}
