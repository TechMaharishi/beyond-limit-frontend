import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import logo from "@/assets/logo.png"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useMutation } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Alert, AlertDescription } from "@/components/ui/alert"

/**
 * Reset Password Page
 * 
 * Final step in the password recovery flow.
 * Allows the user to set a new password after successful OTP verification.
 * Requires 'email' and 'otp' query parameters to be present.
 */
export function ResetPasswordPage() {
    return (
        <div className="flex min-h-svh w-full flex-col items-center justify-center p-6 md:p-10">
            <div className="w-full max-w-md">
                <ResetPasswordForm />
            </div>
            <div className="mt-4 text-center text-sm text-muted-foreground">
                © Beyond Limits Therapy. All rights reserved.
            </div>
        </div>
    )
}

function ResetPasswordForm({
    className,
    ...props
}: React.ComponentProps<"div">) {
    const [searchParams] = useSearchParams()
    const email = searchParams.get("email") || ""
    const otp = searchParams.get("otp") || ""
    
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()

    const { mutate: resetPassword, isPending } = useMutation({
        mutationFn: async (newPassword: string) => {
            const { data, error } = await authClient.emailOtp.resetPassword({
                email,
                otp,
                password: newPassword,
            })
            if (error) throw error
            return data
        },
        onSuccess: () => {
            navigate("/login")
        },
        onError: (err: any) => {
            setError(err.message || "Failed to reset password")
        },
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        const p = password.trim()
        const cp = confirmPassword.trim()
        const valid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/.test(p)
        if (!valid) {
            setError("Password must be 8–64 chars with uppercase, lowercase, number, and symbol")
            return
        }
        if (p !== cp) {
            setError("Passwords do not match")
            return
        }
        resetPassword(p)
    }

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card>
                <CardHeader>
                    <div className="flex justify-center mb-4">
                        <img src={logo} alt="Beyond Limit Logo" className="h-32 w-auto object-contain" />
                    </div>
                    <CardTitle>Reset Password</CardTitle>
                    <CardDescription>
                        Enter your new password below.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit}>
                        <div className="flex flex-col gap-6">
                            {error && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                            <div className="grid gap-2">
                                <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">New Password</label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="new-password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <Eye className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <span className="sr-only">
                                            {showPassword ? "Hide password" : "Show password"}
                                        </span>
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Password must be 8–64 characters and include uppercase, lowercase, number, and symbol.
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <label htmlFor="confirmPassword" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Confirm Password</label>
                                <div className="relative">
                                    <Input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? "text" : "password"}
                                        autoComplete="new-password"
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <Eye className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <span className="sr-only">
                                            {showConfirmPassword ? "Hide password" : "Show password"}
                                        </span>
                                    </Button>
                                </div>
                            </div>
                            <Button type="submit" className="w-full" disabled={isPending}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Resetting Password...
                                    </>
                                ) : (
                                    "Reset Password"
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
