
import { CoursesManager } from "./courses-manager";

/** Page rendering the course manager scoped to Draft status. */
export function DraftCoursesPage() {
  return <CoursesManager pageTitle="Draft Courses" defaultStatus="draft" hideAddButton={true} />;
}
