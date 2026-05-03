import { ShortsManager } from "./shorts-manager";

/** Page rendering the shorts manager scoped to Pending/Rejected review statuses. */
export function PendingShortsPage() {
  return (
    <ShortsManager
        pageTitle="Pending Reviews"
        defaultStatus="pending"
        allowedStatuses={["pending", "rejected"]}
        showStatusFilter={true}
        hideAddButton={true}
    />
  );
}
