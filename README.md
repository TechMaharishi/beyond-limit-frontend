# Beyond Limits Learning Hub — Admin Panel

Modern React + Vite admin frontend for Beyond Limits Paediatric Therapy (BLPT). It enables administrators and training staff to manage courses, short videos, learning tags, users, assignments, and support tickets in a secure, role-based environment.

## Overview
- BLPT is a leading allied health provider in Camden, NSW, delivering evidence-based paediatric therapy for children aged 0–16 (OT, Speech, Physio, Psychology, Dietetics, Exercise Physiology).
- This admin panel streamlines content publishing, user management, reviews, and operational workflows supporting clinical learners and training admins.

## Key Features
- Authentication with better-auth (email OTP), guarded routes, and role-based access
- Dynamic role namespace in URLs (`/:rolePath`) for admin, trainer, trainee, user
- Course and Short video creation/editing, with atomic video deletion for Shorts
- Learning area/tag management with search, filtering, and status controls
- User management: list, search, role actions; assign trainees and courses
- Support tickets: create, list, filter, and manage ticket types
- Modern theming: system-default, toggle between Light/Dark in header
- Fast UI: lazy-loaded routes, React Query caching, Tailwind-powered components

## Tech Stack
- React 19, TypeScript 5.9, Vite 7
- Tailwind CSS v4, Shadcn UI (Radix primitives), lucide-react icons
- TanStack React Query v5, Axios, React Router v7
- next-themes for theming

## Routing & Access
- Public-only routes: `/login`, `/forgot-password`, `/reset-password`, `/verify-otp`
- Protected app shell under `/:rolePath` with nested modules:
  - `/:rolePath/dashboard`
  - `/:rolePath/content/shorts` (published, pending, draft, create/edit)
  - `/:rolePath/content/courses` (published, pending, draft, create/edit)
  - `/:rolePath/content/tags` (learning areas)
  - `/:rolePath/users` (lists), assignments (courses, clinical)
  - `/:rolePath/tickets` (all, create, types)

## Role Mapping
- Display names used across UI:
  - admin → Super Admin
  - trainer → Training Admin
  - trainee → Clinical Learners
  - user → Individual Learners


## Environment
- `VITE_API_URL`: Base URL for API requests (defaults to `https://blpt-backend.onrender.com/api`)
- `VITE_BASE_URL`: Base URL for better-auth client
- Do not commit secrets or private credentials.

## Dev Server Proxy
- Vite dev server proxies `/api` to `https://blpt-backend.onrender.com` for local development.

## Project Structure (selected)
- Entry HTML: `index.html` — head tags, fonts, bootstraps app
- App entry: `src/main.tsx` — providers (themes, query), router
- Routing: `src/routing.tsx` — lazy-loaded routes, guards, error boundary
- Layout: `src/pages/app-shell.tsx` — sidebar, header, theme toggle
- UI components: `src/components/ui/*` — shadcn components
- Services: `src/services/*` — API clients for courses, shorts, support, etc.
- Auth: `src/lib/auth-client.ts` — better-auth client initialization
- API: `src/lib/api.ts` — Axios instance (token, interceptors)

## Requirements
- Node.js 20+ (LTS), pnpm 9+ recommended

## Getting Started
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Lint
pnpm lint

# Build
pnpm build

# Preview production build
pnpm preview
```

## Deployment
- Static build via `vite build`, deploy `dist/` to your hosting provider.
- `vercel.json` includes HTML rewrites and caching headers.
- Ensure environment variables (`VITE_API_URL`, `VITE_BASE_URL`) are configured in the hosting environment.

## Commit Style
- Use Conventional Commits (e.g., `feat:`, `fix:`, `chore:`) for clarity.

## License
- Private, internal to BLPT

## Maintainer
- Built by Vishal Kumar
  - [GitHub](https://github.com/TechMaharishi)
  - [LinkedIn](https://www.linkedin.com/in/techmaharishi/)
  - License: [License](./LICENSE)
