import { createAuthClient } from "better-auth/react"
import { emailOTPClient, adminClient } from "better-auth/client/plugins"

/**
 * Initialized authentication client using `better-auth`.
 * configured with:
 * - `emailOTPClient`: Handles email-based One-Time Password authentication flows.
 * - `adminClient`: Provides administrative capabilities for user management.
 */
export const authClient = createAuthClient({
    baseURL: import.meta.env.VITE_BASE_URL,
    plugins: [
        emailOTPClient(),
        adminClient()
    ]
})