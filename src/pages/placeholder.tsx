import { useLocation } from "react-router-dom";

/**
 * Placeholder Page
 * 
 * Generic fallback component for routes that are under construction or
 * defined in the router but not yet implemented.
 * 
 * Dynamically derives the page title from the current URL path to provide
 * context-aware feedback (e.g., "/users/all" -> "All Users").
 */
export function PlaceholderPage() {
    const location = useLocation();
    
    // Extract the last segment of the path, replace hyphens with spaces, and capitalize words.
    // Example: "/content/video-tags" -> "Video Tags"
    const title = location.pathname.split("/").pop()?.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <h1 className="text-2xl font-bold">{title || "Page"}</h1>
            <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min flex items-center justify-center">
                <span className="text-muted-foreground">Content for {title} goes here</span>
            </div>
        </div>
    );
}
