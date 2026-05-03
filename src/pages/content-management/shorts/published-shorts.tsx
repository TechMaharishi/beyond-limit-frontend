import { ShortsManager } from "./shorts-manager";

/** Page rendering the shorts manager scoped to Published status. */
export function PublishedShortsPage() {
  return <ShortsManager pageTitle="Shorts" defaultStatus="published" />;
}
