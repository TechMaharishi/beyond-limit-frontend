import axios, { AxiosError } from "axios"
import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from "axios"

/**
 * Configured Axios instance for API communication.
 * Sets base URL, default headers, and timeout settings.
 * `withCredentials` is enabled to support cookie-based session management.
 */
export const apiClient: AxiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "https://blpt-backend.onrender.com/api",
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
    timeout: 60000,
})

/**
 * Request Interceptor.
 * Injects authentication tokens into the Authorization header if available.
 * Checks both standard `token` and `better-auth.session_token` storage keys.
 */
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('token') || localStorage.getItem('better-auth.session_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config
    },
    (error: AxiosError) => {
        return Promise.reject(error)
    }
)

/**
 * Response Interceptor.
 * Centralizes error handling for common HTTP status codes.
 * - 401: Unauthorized (e.g., session expiry).
 * - 403: Forbidden (insufficient permissions).
 * - 500: Internal Server Error.
 */
apiClient.interceptors.response.use(
    (response: AxiosResponse) => {
        return response
    },
    async (error: AxiosError) => {
        if (error.response?.status === 401) {
            // Potential redirection logic or token refresh flow should be implemented here.
            console.warn("Unauthorized access - redirecting to login or refreshing token")
        }

        if (error.response?.status === 403) {
            console.warn("Forbidden access")
        }

        if (error.response?.status === 500) {
            console.error("Server error")
        }

        return Promise.reject(error)
    }
)
