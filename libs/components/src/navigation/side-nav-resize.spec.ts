import { SIDERAIL_WIDTH_REM } from "../shared";

import {
  ARROW_STEP_REM,
  SNAP_TO_CLOSED_THRESHOLD_REM,
  TENSION_FACTOR,
  resolveArrowStep,
  resolveDragFromClosed,
  resolveDragFromOpen,
} from "./side-nav-resize";
import { SIDE_NAV_WIDTH_BOUNDS } from "./side-nav-width.service";

describe("resolveDragFromClosed", () => {
  it("aborts when dragged back onto the icon strip", () => {
    expect(resolveDragFromClosed(SIDERAIL_WIDTH_REM - 0.01)).toEqual({ action: "abort" });
  });

  it("previews between the icon strip and the minimum open width", () => {
    expect(resolveDragFromClosed(SIDERAIL_WIDTH_REM)).toEqual({
      action: "preview",
      width: SIDERAIL_WIDTH_REM,
    });
    expect(resolveDragFromClosed(SIDE_NAV_WIDTH_BOUNDS.min - 0.01)).toEqual({
      action: "preview",
      width: SIDE_NAV_WIDTH_BOUNDS.min - 0.01,
    });
  });

  it("opens once the minimum open width is reached", () => {
    expect(resolveDragFromClosed(SIDE_NAV_WIDTH_BOUNDS.min)).toEqual({
      action: "open",
      width: SIDE_NAV_WIDTH_BOUNDS.min,
    });
  });

  it("opens on a flick that overshoots the maximum, leaving the clamp to the width service", () => {
    expect(resolveDragFromClosed(SIDE_NAV_WIDTH_BOUNDS.max + 10)).toEqual({
      action: "open",
      width: SIDE_NAV_WIDTH_BOUNDS.max + 10,
    });
  });
});

describe("resolveDragFromOpen", () => {
  it("paints at or above the minimum open width", () => {
    expect(resolveDragFromOpen(SIDE_NAV_WIDTH_BOUNDS.min)).toEqual({
      action: "paint",
      width: SIDE_NAV_WIDTH_BOUNDS.min,
    });
    expect(resolveDragFromOpen(30)).toEqual({ action: "paint", width: 30 });
  });

  it("gives up only a share of the overshoot inside the tension zone", () => {
    const overshoot = 5;
    expect(resolveDragFromOpen(SIDE_NAV_WIDTH_BOUNDS.min - overshoot)).toEqual({
      action: "tension",
      width: SIDE_NAV_WIDTH_BOUNDS.min - overshoot * TENSION_FACTOR,
    });
  });

  it("keeps the tension preview above the width the pointer is actually at", () => {
    const result = resolveDragFromOpen(SNAP_TO_CLOSED_THRESHOLD_REM);
    expect(result.action).toBe("tension");
    expect(result).toHaveProperty("width");
    expect((result as { width: number }).width).toBeGreaterThan(SNAP_TO_CLOSED_THRESHOLD_REM);
  });

  it("collapses past the snap threshold", () => {
    expect(resolveDragFromOpen(SNAP_TO_CLOSED_THRESHOLD_REM - 0.01)).toEqual({
      action: "collapse",
    });
  });
});

describe("resolveArrowStep", () => {
  it("expands on ArrowRight while closed", () => {
    expect(resolveArrowStep("ArrowRight", SIDE_NAV_WIDTH_BOUNDS.default, false)).toEqual({
      action: "expand",
    });
  });

  it("does nothing on ArrowLeft while closed — it is already the low end of the range", () => {
    expect(resolveArrowStep("ArrowLeft", SIDE_NAV_WIDTH_BOUNDS.default, false)).toEqual({
      action: "noop",
    });
  });

  it("steps symmetrically while open", () => {
    expect(resolveArrowStep("ArrowRight", 20, true)).toEqual({
      action: "commit",
      width: 20 + ARROW_STEP_REM,
    });
    expect(resolveArrowStep("ArrowLeft", 20, true)).toEqual({
      action: "commit",
      width: 20 - ARROW_STEP_REM,
    });
  });

  it("collapses when stepping left off the minimum, mirroring the drag snap", () => {
    expect(resolveArrowStep("ArrowLeft", SIDE_NAV_WIDTH_BOUNDS.min, true)).toEqual({
      action: "collapse",
    });
  });

  it("commits past the bounds, leaving the clamp to the width service", () => {
    expect(resolveArrowStep("ArrowRight", SIDE_NAV_WIDTH_BOUNDS.max, true)).toEqual({
      action: "commit",
      width: SIDE_NAV_WIDTH_BOUNDS.max + ARROW_STEP_REM,
    });
  });
});
