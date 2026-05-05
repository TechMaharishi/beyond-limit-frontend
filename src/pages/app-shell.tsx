import { Outlet } from "react-router-dom"
import { AppSidebar } from "@/components/app-sidebar"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { Suspense } from "react"
import { PageLoader } from "@/components/page-loader"
import { ModeToggle } from "@/components/mode-toggle"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { useNotificationToasts } from "@/hooks/use-notifications"

/**
 * Main application layout shell.
 * 
 * Provides the persistent UI structure (sidebar, header) that wraps all authenticated pages.
 * Uses React Router's <Outlet> to render nested child routes.
 * 
 * Key features:
 * - Responsive sidebar navigation via SidebarProvider
 * - Sticky header with breadcrumbs/context (currently just title)
 * - Suspense boundary for handling lazy-loaded route transitions gracefully
 */
export function AppShell() {
    useNotificationToasts();

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-semibold">Beyond Limits Learning Hub Admin Panel</h1>
                    </div>
                    <div className="ml-auto flex items-center gap-1">
                        <NotificationBell />
                        <ModeToggle />
                    </div>
                </header>
                <div className="flex flex-1 flex-col p-6">
                    {/* 
                      Global Suspense boundary ensuring a consistent loading state 
                      during page transitions or lazy-loading of code chunks.
                    */}
                    <Suspense fallback={<PageLoader />}>
                        <Outlet />
                    </Suspense>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
