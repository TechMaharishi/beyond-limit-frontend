import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility to merge Tailwind CSS classes conditionally.
 * Combines `clsx` for conditional logic and `tailwind-merge` to resolve conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Maps internal user roles to their corresponding URL path segments.
 * Used for generating role-specific navigation links.
 */
export function getRolePath(role: string): string {
  switch (role) {
    case "admin": return "super-admin";
    case "trainer": return "training-admin";
    case "trainee": return "clinical-learner";
    case "user": return "individual-learner";
    default: return "app";
  }
}

/**
 * Resolves a URL path segment back to the internal user role.
 * Useful for validating route access or parsing current context from the URL.
 */
export function getRoleFromPath(path: string): string | null {
  switch (path) {
    case "super-admin": return "admin";
    case "training-admin": return "trainer";
    case "clinical-learner": return "trainee";
    case "individual-learner": return "user";
    default: return null;
  }
}

/**
 * Formats a date into a concise relative time string.
 * Logic:
 * - < 60s: "Xs ago"
 * - < 60m: "Xm ago"
 * - < 24h: "Xh ago"
 * - 24-48h: "Yesterday"
 * - < 7d: "Xd ago"
 * - ≥ 7d: Absolute date (e.g., "12 Jan 2026")
 *
 * Handles invalid date inputs gracefully by returning an empty string.
 */
export function formatRelativeTime(date: string | Date): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 1000));

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  if (diffInHours < 48) {
    return "Yesterday";
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Super Admin",
  trainer: "Training Admin",
  trainee: "Clinical Learners",
  user: "Individual Learners",
};

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function canAccess(role: string, feature: string): boolean {
  if (role === "admin") return true;
  if (feature === "tickets.manage") return false;
  if (role === "trainee") {
    const allowed = new Set<string>([
      "content.shorts",
      "content.reviews.shorts",
      "content.drafts.shorts",
      "tickets.create",
    ]);
    return allowed.has(feature);
  }
  return true;
}

/**
 * Returns the default landing path for a given user role.
 * Clinical Learners land on Short Videos; others land on Dashboard.
 */
export function getRoleHomePath(role: string): string {
  const rolePath = getRolePath(role);
  if (role === "trainee") {
    return `/${rolePath}/content/shorts`;
  }
  return `/${rolePath}/dashboard`;
}

export function filterMenuItemsByRole<T extends { title: string; items?: T[] }>(role: string, items: T[]): T[] {
  if (role === "admin") return items.filter(item => item.title !== "Assign Courses" && item.title !== "Assign Shorts");
  const result: T[] = [];
  for (const item of items) {
    if (item.title === "Ticket Management") {
      continue;
    }
    if (role === "trainee") {
      if (item.title === "Assign Courses" || item.title === "Assign Shorts") {
        result.push({ ...item });
        continue;
      }
      if (item.title === "Content Management") {
        const filtered: T = { ...(item as any), items: [] as any[] } as T;
        for (const sub of item.items || []) {
          if (sub.title === "Short Videos") {
            (filtered.items as T[]).push({ ...sub });
          } else if (sub.title === "Reviews") {
            const reviews: T = { ...(sub as any), items: [] as any[] } as T;
            for (const r of (sub.items || [])) {
              if ((r as any).title === "Pending Shorts") (reviews.items as T[]).push({ ...r });
            }
            if ((reviews.items as T[]).length) (filtered.items as T[]).push(reviews);
          } else if (sub.title === "Drafts") {
            const drafts: T = { ...(sub as any), items: [] as any[] } as T;
            for (const d of (sub.items || [])) {
              if ((d as any).title === "Draft Shorts") (drafts.items as T[]).push({ ...d });
            }
            if ((drafts.items as T[]).length) (filtered.items as T[]).push(drafts);
          }
        }
        if ((filtered.items as T[]).length) result.push(filtered);
        continue;
      }
      if (item.title === "Create Ticket") {
        result.push({ ...item });
        continue;
      }
      continue;
    }
    if (item.title === "Assign Courses" || item.title === "Assign Shorts") {
      continue;
    }
    result.push({ ...item });
  }
  return result;
}
