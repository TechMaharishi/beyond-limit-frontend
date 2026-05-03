import { authClient } from "@/lib/auth-client"
import { Navigate, Outlet } from "react-router-dom"
import { PageLoader } from "./page-loader"
import { getRoleHomePath } from "@/lib/utils"
import { type ReactNode, useState, useEffect } from "react"

/**
 * Route wrapper for public-only pages (e.g., Login, Register).
 * Redirects authenticated users to their dashboard to prevent redundant access.
 */
export function PublicOnlyRoute({ children }: { children?: ReactNode }) {
    const { data: session, isPending } = authClient.useSession()
    const [hasChecked, setHasChecked] = useState(false)

    useEffect(() => {
        if (!isPending) {
            setHasChecked(true)
        }
    }, [isPending])

    if (isPending && !hasChecked) {
        return <PageLoader />
    }

    // If session exists, redirect to the appropriate dashboard based on role.
    if (session) {
        const role = (session.user as any).role || "user";
        return <Navigate to={getRoleHomePath(role)} />
    }

    return children ? <>{children}</> : <Outlet />
}
