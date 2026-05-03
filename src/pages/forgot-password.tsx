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
import { Loader2, ArrowLeft } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Alert, AlertDescription } from "@/components/ui/alert"

/**
 * Forgot Password Page
 * 
 * Entry point for the password recovery flow.
 * Captures the user's email and initiates the OTP generation process.
 */
export function ForgotPasswordPage() {
    return (
        <div className="flex min-h-svh w-full flex-col items-center justify-center p-6 md:p-10">
            <div className="w-full max-w-md">
                <ForgotPasswordForm />
            </div>
            <div className="mt-4 text-center text-sm text-muted-foreground">
                © Beyond Limits Therapy. All rights reserved.
            </div>
        </div>
    )
}

function ForgotPasswordForm({
    className,
    ...props
}: React.ComponentProps<"div">) {
    const [email, setEmail] = useState("")
    const [error, setError] = useState<string | null>(null)
    const navigate = useNavigate()

    // Mutation to trigger the backend email OTP service
    const { mutate: sendResetCode, isPending } = useMutation({
        mutationFn: async (emailVal: string) => {
            const { data, error } = await authClient.forgetPassword.emailOtp({
                email: emailVal,
            })
            if (error) throw error
            return data
        },
        onSuccess: (_, variables) => {
            // Redirect to OTP verification page with context (email and flow type)
            navigate(`/verify-otp?email=${encodeURIComponent(variables)}&type=forget-password`)
        },
        onError: (err: any) => {
            setError(err.message || "Failed to send reset code")
        },
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        sendResetCode(email.trim())
    }

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card>
                <CardHeader>
                    <div className="flex justify-center mb-4">
                        <img src={logo} alt="Beyond Limit Logo" className="h-32 w-auto object-contain" />
                    </div>
                    <CardTitle>Forgot Password</CardTitle>
                    <CardDescription>
                        Enter your email to receive a password reset code.
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
                                <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Email</label>
                                <Input
                                    id="email"
                                    type="email"
                                    autoComplete="username"
                                    placeholder="admin@beyondlimitstherapy.com.au"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isPending}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending Code...
                                    </>
                                ) : (
                                    "Send Reset Code"
                                )}
                            </Button>
                            <Button variant="ghost" className="w-full" onClick={() => navigate("/login")}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Login
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
