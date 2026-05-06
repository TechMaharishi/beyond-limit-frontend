import { createAuthClient } from "better-auth/react"
import { emailOTPClient, adminClient } from "better-auth/client/plugins"
import { sentinelClient } from "@better-auth/infra/client"

/**
 * Initialized authentication client using `better-auth`.
 * configured with:
 * - `emailOTPClient`: Handles email-based One-Time Password authentication flows.
 * - `adminClient`: Provides administrative capabilities for user management.
 * - `sentinelClient`: Provides infrastructure monitoring and anomaly detection.
 */
export const authClient = createAuthClient({
    baseURL: import.meta.env.VITE_BASE_URL,
    plugins: [
        emailOTPClient(),
        adminClient(),
        sentinelClient()
    ]
})