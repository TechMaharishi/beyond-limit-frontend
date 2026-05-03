
import { CoursesManager } from "./courses-manager";

/** Page rendering the course manager scoped to Published status. */
export function PublishedCoursesPage() {
  return <CoursesManager pageTitle="Courses" defaultStatus="published" />;
}
