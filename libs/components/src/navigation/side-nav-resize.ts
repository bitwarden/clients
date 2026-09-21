import { SIDERAIL_WIDTH_REM } from "../shared";

import { SIDE_NAV_WIDTH_BOUNDS } from "./side-nav-width.service";

/**
 * The arithmetic behind a resize gesture, kept free of Angular and of any state.
 *
 * Each resolver answers "what does a gesture at this width mean?" and nothing more — applying the
 * answer (open/closed state, paint vs. persist) is `SideNavService`'s job, and holding the result
 * within the saved-width bounds is `SideNavWidthService`'s.
 */

/** How far past the minimum a drag must travel before the nav snaps closed, in rem. */
export const SNAP_TO_CLOSED_THRESHOLD_REM = 4; // 64px — 176px of tension past the 240px minimum

/** Share of the overshoot the nav still gives up in the tension zone, signalling the coming snap. */
export const TENSION_FACTOR = 0.15;

/** How much one arrow keypress moves the width, in rem. */
export const ARROW_STEP_REM = 1;

/** Where `widthRem` sits in the handle's travel, collapsed (0) to widest (100). Whole numbers only,
 *  so a pointer drag does not announce the float it commits. */
export function resizeHandlePercent(widthRem: number): number {
  const travel = SIDE_NAV_WIDTH_BOUNDS.max - SIDERAIL_WIDTH_REM;
  return Math.round(((widthRem - SIDERAIL_WIDTH_REM) / travel) * 100);
}

export type DragFromClosed =
  /** Dragged back onto the icon strip — stay collapsed and drop the preview. */
  | { action: "abort" }
  /** Crossed the minimum — the nav genuinely opens at this width. */
  | { action: "open"; width: number }
  /** Still short of the minimum — preview this width without opening. */
  | { action: "preview"; width: number };

export type DragFromOpen =
  /** Dragged far enough past the minimum to snap closed. */
  | { action: "collapse" }
  /** Inside the tension zone — preview this shrunken width. */
  | { action: "tension"; width: number }
  /** A normal resize — paint this width. */
  | { action: "paint"; width: number };

export type ArrowStep =
  /** Off the low end of the range — open at the width the user last chose. */
  | { action: "expand" }
  /** Stepped left off the minimum, mirroring the drag snap. */
  | { action: "collapse" }
  /** A normal step — this is the user's new preference. */
  | { action: "commit"; width: number }
  /** Already at the low end and moving lower. */
  | { action: "noop" };

/** What a pointer drag to `widthRem` means while the nav is closed. */
export function resolveDragFromClosed(widthRem: number): DragFromClosed {
  if (widthRem < SIDERAIL_WIDTH_REM) {
    return { action: "abort" };
  }

  if (widthRem >= SIDE_NAV_WIDTH_BOUNDS.min) {
    return { action: "open", width: widthRem };
  }

  return { action: "preview", width: widthRem };
}

/** What a pointer drag to `widthRem` means while the nav is open. */
export function resolveDragFromOpen(widthRem: number): DragFromOpen {
  if (widthRem < SNAP_TO_CLOSED_THRESHOLD_REM) {
    return { action: "collapse" };
  }

  if (widthRem < SIDE_NAV_WIDTH_BOUNDS.min) {
    const overshoot = SIDE_NAV_WIDTH_BOUNDS.min - widthRem;
    return { action: "tension", width: SIDE_NAV_WIDTH_BOUNDS.min - overshoot * TENSION_FACTOR };
  }

  return { action: "paint", width: widthRem };
}

/**
 * What an arrow keypress means at `currentWidth`. The collapsed state is the low end of the range,
 * so the arrows cross the collapse boundary in both directions.
 */
export function resolveArrowStep(
  key: "ArrowRight" | "ArrowLeft",
  currentWidth: number,
  open: boolean,
): ArrowStep {
  if (!open) {
    return key === "ArrowRight" ? { action: "expand" } : { action: "noop" };
  }

  if (key === "ArrowLeft" && currentWidth <= SIDE_NAV_WIDTH_BOUNDS.min) {
    return { action: "collapse" };
  }

  const delta = key === "ArrowLeft" ? -ARROW_STEP_REM : ARROW_STEP_REM;
  return { action: "commit", width: currentWidth + delta };
}
