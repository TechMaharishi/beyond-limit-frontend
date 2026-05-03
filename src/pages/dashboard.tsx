
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Cog } from "lucide-react"

export function DashboardPage() {
    return (
        <div className="flex h-full w-full items-center justify-center p-6">
            <div className="w-full max-w-xl">
                <CardHeader className="flex items-center">
                    <div className="flex items-center justify-center rounded-full bg-muted size-24 sm:size-28">
                        <Cog className="h-14 w-14 sm:h-16 sm:w-16 text-muted-foreground animate-spin" />
                    </div>
                    <CardTitle className="mt-4 text-center">
                        We’re crafting something great for you
                    </CardTitle>
                    
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                    <div className="text-center text-sm text-muted-foreground">
                        This dashboard is currently under active development.
                    </div>
                </CardContent>
            </div>
        </div>
    )
}
