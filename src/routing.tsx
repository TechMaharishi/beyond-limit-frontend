import { createBrowserRouter, Navigate } from "react-router-dom";
import { Suspense } from "react";
import { AppShell } from "./pages/app-shell";
import { ProtectedRoute } from "@/components/protected-route";
import { PublicOnlyRoute } from "@/components/public-only-route";
import { PageLoader } from "@/components/page-loader";
import { lazyLoad } from "@/utils/lazy-load";
import { AppError } from "./components/app-error";

/**
 * Route Configuration
 * 
 * Defines the application's routing structure using React Router v6 data API.
 * 
 * Key Features:
 * - Code Splitting: All page components are lazy-loaded to optimize initial bundle size.
 * - Role-Based Access Control (RBAC): The `/:rolePath` dynamic segment aligns the URL structure 
 *   with the user's role (e.g., `/admin/dashboard`, `/trainer/content`).
 * - Route Guards: 
 *   - `ProtectedRoute`: Ensures only authenticated users can access the application shell.
 *   - `PublicOnlyRoute`: Prevents authenticated users from accessing login/registration pages.
 * - Error Handling: A global `AppError` component catches and displays route-level exceptions.
 */

// Lazy-loaded components for performance optimization (Code Splitting)
const DashboardPage = lazyLoad(() => import("@/pages/dashboard").then(m => ({ default: m.DashboardPage })));
const LoginPage = lazyLoad(() => import("@/pages/login").then(m => ({ default: m.LoginPage })));
const OTPVerificationPage = lazyLoad(() => import("@/pages/otp-verification").then(m => ({ default: m.OTPVerificationPage })));
const ForgotPasswordPage = lazyLoad(() => import("@/pages/forgot-password").then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazyLoad(() => import("@/pages/reset-password").then(m => ({ default: m.ResetPasswordPage })));
const TicketTypesPage = lazyLoad(() => import("@/pages/ticket-management/ticket-types").then(m => ({ default: m.TicketTypesPage })));
const AllTicketsPage = lazyLoad(() => import("@/pages/ticket-management/all-ticket"));
const CreateTicketPage = lazyLoad(() => import("@/pages/ticket-management/create-ticket"));
const AllUsersPage = lazyLoad(() => import("@/pages/users-management/all-users"));
const AssignTraineePage = lazyLoad(() => import("@/pages/users-management/assign-trainee"));
const AssignCoursePage = lazyLoad(() => import("@/pages/users-management/assign-course"));
const AssignShortsPage = lazyLoad(() => import("@/pages/users-management/assign-shorts"));
const VideoTagsPage = lazyLoad(() => import("@/pages/content-management/video-tags"));
const CreateCoursePage = lazyLoad(() => import("@/components/course/create-course"));
const PublishedCoursesPage = lazyLoad(() => import("@/pages/content-management/courses/published-courses").then(m => ({ default: m.PublishedCoursesPage })));
const PendingCoursesPage = lazyLoad(() => import("@/pages/content-management/courses/pending-course").then(m => ({ default: m.PendingCoursesPage })));
const DraftCoursesPage = lazyLoad(() => import("@/pages/content-management/courses/draft-course").then(m => ({ default: m.DraftCoursesPage })));
const PublishedShortsPage = lazyLoad(() => import("@/pages/content-management/shorts/published-shorts").then(m => ({ default: m.PublishedShortsPage })));
const PendingShortsPage = lazyLoad(() => import("@/pages/content-management/shorts/pending-shorts").then(m => ({ default: m.PendingShortsPage })));
const DraftShortsPage = lazyLoad(() => import("@/pages/content-management/shorts/draft-shorts").then(m => ({ default: m.DraftShortsPage })));
const CreateShortPage = lazyLoad(() => import("@/components/shorts/create-short"));

const router = createBrowserRouter([
    // Public Authentication Routes
    // Wrapped in `PublicOnlyRoute` to redirect authenticated users to their dashboard.
    {
        path: "/login",
        element: (
            <PublicOnlyRoute>
                <Suspense fallback={<PageLoader />}>
                    <LoginPage />
                </Suspense>
            </PublicOnlyRoute>
        ),
    },
    {
        path: "/forgot-password",
        element: (
            <PublicOnlyRoute>
                <Suspense fallback={<PageLoader />}>
                    <ForgotPasswordPage />
                </Suspense>
            </PublicOnlyRoute>
        ),
    },
    {
        path: "/reset-password",
        element: (
            <PublicOnlyRoute>
                <Suspense fallback={<PageLoader />}>
                    <ResetPasswordPage />
                </Suspense>
            </PublicOnlyRoute>
        ),
    },

    // OTP Verification
    // Accessible to users who need to verify their identity (e.g., during 2FA or password reset).
    {
        path: "/verify-otp",
        element: (
            <Suspense fallback={<PageLoader />}>
                <OTPVerificationPage />
            </Suspense>
        ),
    },

    // Default Redirect
    // Redirects the root path to the login page.
    {
        path: "/",
        element: <Navigate to="/login" />,
    },

    // Protected Application Routes
    // Encapsulates the main application logic behind the `ProtectedRoute` guard.
    // The `:rolePath` parameter supports role-specific URL namespaces.
    {
        path: "/:rolePath",
        errorElement: <AppError />,
        element: (
            <ProtectedRoute>
                <AppShell />
            </ProtectedRoute>
        ),
        children: [
            {
                path: "dashboard",
                element: <DashboardPage />,
            },

            // Content Management Module
            {
                path: "content",
                children: [
                    {
                        path: "shorts",
                        element: <PublishedShortsPage />,
                    },
                    {
                        path: "shorts/create",
                        element: <CreateShortPage />,
                    },
                    {
                        path: "shorts/:shortId/edit",
                        element: <CreateShortPage />,
                    },
                    {
                        path: "courses/create",
                        element: <CreateCoursePage />,
                    },
                    {
                        path: "courses/:courseId/edit",
                        element: <CreateCoursePage />,
                    },
                    {
                        path: "courses",
                        element: <PublishedCoursesPage />,
                    },
                    {
                        path: "reviews",
                        children: [
                            {
                                path: "shorts",
                                element: <PendingShortsPage />,
                            },
                            {
                                path: "courses",
                                element: <PendingCoursesPage />,
                            },
                        ]
                    },
                    {
                        path: "drafts",
                        children: [
                            {
                                path: "shorts",
                                element: <DraftShortsPage />,
                            },
                            {
                                path: "courses",
                                element: <DraftCoursesPage />,
                            },
                        ]
                    },
                    {
                        path: "tags",
                        element: <VideoTagsPage />,
                    },
                ]
            },

            // User Management Module
            {
                path: "users",
                children: [
                    {
                        path: "all",
                        element: <AllUsersPage />,
                    },
                    {
                        path: "assignments",
                        children: [
                            {
                                path: "courses",
                                element: <AssignCoursePage />,
                            },
                            {
                                path: "shorts",
                                element: <AssignShortsPage />,
                            },
                            {
                                path: "clinical",
                                element: <AssignTraineePage />,
                            },
                        ]
                    },
                ]
            },

            // Ticket Management Module
            {
                path: "tickets",
                children: [
                    {
                        path: "all",
                        element: <AllTicketsPage />,
                    },
                    {
                        path: "create",
                        element: <CreateTicketPage />,
                    },
                    {
                        path: "types",
                        element: <TicketTypesPage />,
                    },
                ]
            },
        ],
    },
]);

export default router;
