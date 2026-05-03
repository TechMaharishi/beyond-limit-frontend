import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    modulePreload: {
      polyfill: true,
    },
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-core';
            }
            if (id.includes('@tanstack') || id.includes('axios')) {
              return 'vendor-data';
            }
            if (id.includes('lucide-react') || id.includes('framer-motion')) {
              return 'vendor-ui';
            }
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "https://blpt-backend.onrender.com",
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "localhost",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})