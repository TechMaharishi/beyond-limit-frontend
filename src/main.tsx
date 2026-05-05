import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import router from '@/routing'
import { Toaster } from '@/components/ui/sonner'
import { initWebPush } from '@/lib/web-push'
import { notificationsKeys } from '@/hooks/use-notifications'

const queryClient = new QueryClient()

// Initialize web push after the app is mounted. The callback invalidates the
// notifications query so the bell updates immediately when a foreground message arrives.
initWebPush(() => {
  queryClient.invalidateQueries({ queryKey: notificationsKeys.all })
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
