
import { CoursesManager } from "./courses-manager";

/** Page rendering the course manager scoped to Pending/Rejected review statuses. */
export function PendingCoursesPage() {
  return (
    <CoursesManager 
        pageTitle="Pending Reviews" 
        defaultStatus="pending" 
        allowedStatuses={["pending", "rejected"]}
        showStatusFilter={true}
        hideAddButton={true}
    />
  );
}
