import { IconTileOptions } from "@bitwarden/components";

import { ACCESS_BADGE_LOOK } from "../access-state-badge/access-badge-state";

/**
 * How each access state reads in a Status chip, shared by the Approvals and My requests tabs so
 * one table cannot drift from the other or from the badge beside it. The icons come off
 * {@link ACCESS_BADGE_LOOK}; the tile variants are a separate palette from the badge's, so they
 * live here.
 *
 * `ready` carries the requester's word. An approver looking at the same grant has nothing to
 * use, so the Approvals tab overrides that one label with `pamStatusApproved` — the same
 * override its badge takes through `readyLabelKey`. Every other word is shared outright.
 */
export const REQUEST_STATUS_LOOK = Object.freeze({
  pending: {
    labelKey: "pamAccessBadgePending",
    tile: { icon: ACCESS_BADGE_LOOK.pending.icon, variant: "warning" },
  },
  ready: {
    labelKey: "pamAccessBadgeReady",
    tile: { icon: ACCESS_BADGE_LOOK.ready.icon, variant: "success" },
  },
  inUse: {
    labelKey: "pamStatusInUse",
    tile: { icon: ACCESS_BADGE_LOOK.active.icon, variant: "primary" },
  },
  endingSoon: {
    labelKey: "pamStatusEndingSoon",
    tile: { icon: ACCESS_BADGE_LOOK.endingSoon.icon, variant: "danger" },
  },
  // My requests only: the Approvals tab drops a row once its window closes.
  expired: {
    labelKey: "pamStatusExpired",
    tile: { icon: ACCESS_BADGE_LOOK.expired.icon, variant: "dark" },
  },
} as const satisfies Record<string, { labelKey: string; tile: IconTileOptions }>);

/** The approver's word for a grant the requester has not started. */
export const APPROVER_READY_LABEL_KEY = "pamStatusApproved";
