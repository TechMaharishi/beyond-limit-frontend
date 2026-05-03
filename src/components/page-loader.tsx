import { Spinner } from "@/components/ui/spinner"

/**
 * Full-screen loading indicator.
 * Used during initial session checks or heavy page transitions.
 */
export function PageLoader() {
    return (
        <div className="flex h-screen w-full items-center justify-center">
            <Spinner size="lg" />
        </div>
    )
}
