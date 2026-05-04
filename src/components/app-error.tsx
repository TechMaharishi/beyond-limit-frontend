import { useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * Global Error Boundary Component
 * 
 * Displays a user-friendly error message when an uncaught exception occurs 
 * within the routing context. It provides a fallback UI and a way to navigate 
 * back to a safe state (Login).
 */
export function AppError() {
    const error = useRouteError() as Error;
    // Check for chunk load errors or dynamic import failures
    const isChunkError =
        error?.name === 'ChunkLoadError' ||
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed');

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
            <h2 className="text-xl font-semibold">
                {isChunkError ? "New Version Available" : "Something went wrong"}
            </h2>
            <p className="text-muted-foreground text-center max-w-md">
                {isChunkError
                    ? "A new version of the application is available. Please reload to update."
                    : (error?.message || "We couldn't connect to the server. Please check your internet connection or try again later.")}
            </p>
            <div className="flex gap-2">
                <Button onClick={() => window.location.reload()}>
                    Reload Page
                </Button>
                {!isChunkError && (
                    <Button variant="outline" onClick={() => window.location.href = "/login"}>
                        Back to Login
                    </Button>
                )}
            </div>
        </div>
    );
}
