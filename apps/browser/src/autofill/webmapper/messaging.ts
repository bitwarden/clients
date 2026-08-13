// Shared message/response shapes for webmapper's content-script ↔ background
// selector capture. Imported by both the content script (context-menu-handler)
// and the background (context-menu-clicked-handler).

import type { ContainerCandidate } from "./draft";

// A {@link WebmapperCommand.GetSelector} request responds with a
// `GeneratedSelector` (from ./selector) directly — no wrapper shape.

/** Tab-message command names for webmapper selector capture. */
export const WebmapperCommand = Object.freeze({
  GetSelector: "webmapperGetSelector",
  GetContainerCandidates: "webmapperGetContainerCandidates",
} as const);

/** Response to a {@link WebmapperCommand.GetContainerCandidates} request. */
export interface WebmapperContainerCandidatesResponse {
  candidates: ContainerCandidate[];
}
