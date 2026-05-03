import { ShortsManager } from "./shorts-manager";

/** Page rendering the shorts manager scoped to Draft status. */
export function DraftShortsPage() {
  return <ShortsManager pageTitle="Draft Shorts" defaultStatus="draft" hideAddButton={true} />;
}
