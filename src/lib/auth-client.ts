import { createAuthClient } from "better-auth/react"
import { emailOTPClient, adminClient } from "better-auth/client/plugins"
import { dashClient } from "@better-auth/infra/client"
// import { sentinelClient } from "@better-auth/infra/client"

/**
 * Initialized authentication client using `better-auth`.
 * configured with:
 * - `emailOTPClient`: Handles email-based One-Time Password authentication flows.
 * - `adminClient`: Provides administrative capabilities for user management.
 * - `sentinelClient`: Provides infrastructure monitoring and anomaly detection.
 * - `dashClient`: Provides dashboard analytics.
 */
export const authClient = createAuthClient({
    baseURL: import.meta.env.VITE_BASE_URL,
    fetchOptions: {
        credentials: "include",
    },
    plugins: [
        emailOTPClient(),
        adminClient(),
        dashClient(),
        // sentinelClient()
    ]
})