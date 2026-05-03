import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import logo from "@/assets/logo.png"
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp"
import { authClient } from "@/lib/auth-client"
import { useMutation } from "@tanstack/react-query"
import { useSearchParams, useNavigate, useLocation } from "react-router-dom"
import { useState, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { getRoleHomePath } from "@/lib/utils"

/**
 * OTP Verification Page
 * 
 * Multi-purpose page for verifying One-Time Passwords (OTPs).
 * Handles two distinct flows based on the 'type' URL parameter:
 * 1. Email Verification: Confirms a new user's email address.
 * 2. Password Reset: Verifies identity before allowing password change.
 */
export function OTPVerificationPage() {
    const [searchParams] = useSearchParams()
    const email = searchParams.get("email") || ""
    const type = searchParams.get("type") || "email-verification"
    const [otp, setOtp] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [timer, setTimer] = useState(0)
    const [attempts, setAttempts] = useState(0)
    const navigate = useNavigate()
    const location = useLocation()
    const password = location.state?.password
    const rememberMe = location.state?.rememberMe

    // Load timer state from localStorage on mount
    useEffect(() => {
        const savedTimer = localStorage.getItem("otp_timer")
        const savedTimestamp = localStorage.getItem("otp_timestamp")
        const savedAttempts = localStorage.getItem("otp_attempts")

        if (savedTimestamp) {
            const now = Date.now()
            const elapsedMs = now - parseInt(savedTimestamp, 10)
            // 30-minute expiration window for soft attempt limit
            if (elapsedMs > 30 * 60 * 1000) {
                setAttempts(0)
                setTimer(0)
                localStorage.removeItem("otp_timer")
                localStorage.removeItem("otp_attempts")
                localStorage.removeItem("otp_timestamp")
            }
        }

        if (savedAttempts) {
            setAttempts(parseInt(savedAttempts, 10))
        }

        if (savedTimer && savedTimestamp) {
            const now = Date.now()
            const elapsed = Math.floor((now - parseInt(savedTimestamp, 10)) / 1000)
            const remaining = parseInt(savedTimer, 10) - elapsed
            if (remaining > 0) {
                setTimer(remaining)
            } else {
                setTimer(0)
                localStorage.removeItem("otp_timer")
                // keep timestamp to allow 30-min soft limit expiry tracking
            }
        }
    }, [])

    // Timer countdown effect
    useEffect(() => {
        if (timer > 0) {
            const interval = setInterval(() => {
                setTimer((prev) => {
                    const next = prev - 1
                    localStorage.setItem("otp_timer", next.toString())
                    if (next <= 0) {
                         localStorage.removeItem("otp_timer")
                         return 0
                    }
                    return next
                })
            }, 1000)
            return () => clearInterval(interval)
        }
    }, [timer])

    // Auto-reset soft limit after 30 minutes without requiring a page refresh
    useEffect(() => {
        const checkExpiry = () => {
            const ts = localStorage.getItem("otp_timestamp")
            const atp = localStorage.getItem("otp_attempts")
            if (!ts || !atp) return
            if (parseInt(atp, 10) >= 5) {
                const elapsedMs = Date.now() - parseInt(ts, 10)
                if (elapsedMs > 30 * 60 * 1000) {
                    setAttempts(0)
                    localStorage.removeItem("otp_attempts")
                    // keep timestamp; next resend will update it
                }
            }
        }
        const interval = setInterval(checkExpiry, 30000) // check every 30s
        return () => clearInterval(interval)
    }, [])

    const { mutate: signIn } = useMutation({
        mutationFn: async () => {
             if (!password) throw new Error("No password available for auto-login")
             const { data, error } = await authClient.signIn.email({
                 email,
                 password,
                 rememberMe,
             })
             if (error) throw error
             return data
        },
        onSuccess: (data) => {
             const role = data.user ? ((data.user as any).role || "user") : "user";
             navigate(getRoleHomePath(role), { replace: true })
        },
        onError: () => {
             // Fallback to login page if auto-login fails
             navigate("/login")
        }
    })

    const { mutate: verifyOtp, isPending } = useMutation({
        mutationFn: async () => {
            // Flow 1: Email Verification
            if (type === "email-verification") {
                const { data, error } = await authClient.emailOtp.verifyEmail({
                    email,
                    otp,
                })
                if (error) throw error
                return { type: "email-verification", data }
            } 
            // Flow 2: Forgot Password OTP check
            else if (type === "forget-password") {
                const { data, error } = await authClient.emailOtp.checkVerificationOtp({
                    email,
                    type: "forget-password",
                    otp,
                })
                if (error) throw error
                return { type: "forget-password", data }
            } else {
                throw new Error("Invalid verification type")
            }
        },
        onSuccess: async (result) => {
            // Clear OTP timer state on success
            localStorage.removeItem("otp_timer")
            localStorage.removeItem("otp_timestamp")
            localStorage.removeItem("otp_attempts")

            if (result.type === "email-verification") {
                // If we have password passed from login/signup, attempt auto-login
                if (password) {
                    signIn()
                } else {
                    // Check if the backend established a session (auto-login via cookie)
                    const { data: session } = await authClient.getSession();
                    
                    if (session) {
                        const role = (session.user as any).role || "user";
                        navigate(getRoleHomePath(role), { replace: true });
                    } else {
                        // Fallback to login if auto-login didn't happen and no password available
                        navigate("/login", { replace: true });
                    }
                }
            } else if (result.type === "forget-password") {
                // On success, pass the verified OTP and email to the reset password page
                navigate(`/reset-password?email=${encodeURIComponent(email)}&otp=${otp}`)
            }
        },
        onError: (err: any) => {
            setError(err.message || "Verification failed")
        },
    })

    const { mutate: resendOtp, isPending: isResending } = useMutation({
        mutationFn: async () => {
            const { error } = await authClient.emailOtp.sendVerificationOtp({
                email,
                type: type as any, 
            })
            if (error) throw error
        },
        onSuccess: () => {
            // Progressive backoff: 60s, 120s, 180s...
            const nextAttempt = attempts + 1
            const nextDuration = 60 * nextAttempt
            
            setAttempts(nextAttempt)
            setTimer(nextDuration)
            
            localStorage.setItem("otp_attempts", nextAttempt.toString())
            localStorage.setItem("otp_timer", nextDuration.toString())
            localStorage.setItem("otp_timestamp", Date.now().toString())
        },
        onError: (err: any) => {
            setError(err.message || "Failed to resend OTP")
        }
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        verifyOtp()
    }

    const handleResend = () => {
        setError(null)
        // Soft limit: 5 attempts
        if (attempts >= 5) {
            setError("Too many resend attempts. Please try again after 30 minutes.")
            return
        }
        resendOtp()
    }

    return (
        <div className="flex min-h-svh w-full flex-col items-center justify-center p-6 md:p-10">
            <div className="w-full max-w-md">
                <Card>
                    <CardHeader>
                        <div className="flex justify-center mb-4">
                            <img src={logo} alt="Beyond Limit Logo" className="h-32 w-auto object-contain" />
                        </div>
                        <CardTitle>Verify your email</CardTitle>
                        <CardDescription>
                            Enter the 6-digit code sent to your email address.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="flex flex-col gap-6 items-center" onSubmit={handleSubmit}>
                            {(error || (location.state as any)?.verificationInitError) && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error ?? (location.state as any)?.verificationInitError}</AlertDescription>
                                </Alert>
                            )}
                            
                            <div className="flex flex-col items-center gap-2">
                                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                                    <InputOTPGroup>
                                        <InputOTPSlot index={0} />
                                        <InputOTPSlot index={1} />
                                        <InputOTPSlot index={2} />
                                        <InputOTPSlot index={3} />
                                        <InputOTPSlot index={4} />
                                        <InputOTPSlot index={5} />
                                    </InputOTPGroup>
                                </InputOTP>
                                <p className="text-xs text-muted-foreground mt-2">
                                    OTP is valid for 15 minutes
                                </p>
                            </div>

                            <Button type="submit" className="w-full" disabled={isPending}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    "Verify"
                                )}
                            </Button>

                            <div className="text-center text-sm">
                                {timer > 0 ? (
                                    <p className="text-muted-foreground">
                                        Resend code in <span className="font-medium text-foreground">{timer}s</span>
                                    </p>
                                ) : (
                                    <Button 
                                        type="button" 
                                        variant="link" 
                                        className="p-0 h-auto font-normal"
                                        onClick={handleResend}
                                        disabled={isResending}
                                    >
                                        {isResending ? (
                                            <>
                                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                Did not receive the code? <span className="font-medium underline ml-1">Resend</span>
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
            <div className="mt-4 text-center text-sm text-muted-foreground">
                © Beyond Limits Therapy. All rights reserved.
            </div>
        </div>
    )
}
