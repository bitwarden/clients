import { ConnectedPosition } from "@angular/cdk/overlay";

const ORIGIN_OFFSET_PX = 10;

export type TooltipPositionIdentifier =
  | "right-center"
  | "left-center"
  | "below-center"
  | "above-center";

export interface TooltipPosition extends ConnectedPosition {
  id: TooltipPositionIdentifier;
}

export const tooltipPositions: TooltipPosition[] = [
  /**
   * The order of these positions matters. The Tooltip component will use
   * the first position that fits within the viewport.
   */

  // Tooltip opens to right of trigger
  {
    id: "right-center",
    offsetX: ORIGIN_OFFSET_PX,
    originX: "end",
    originY: "center",
    overlayX: "start",
    overlayY: "center",
    panelClass: ["bit-tooltip-right-center"],
  },
  // ... to left of trigger
  {
    id: "left-center",
    offsetX: -ORIGIN_OFFSET_PX,
    originX: "start",
    originY: "center",
    overlayX: "end",
    overlayY: "center",
    panelClass: ["bit-tooltip-left-center"],
  },
  // ... below trigger
  {
    id: "below-center",
    offsetY: ORIGIN_OFFSET_PX,
    originX: "center",
    originY: "bottom",
    overlayX: "center",
    overlayY: "top",
    panelClass: ["bit-tooltip-below-center"],
  },
  // ... above trigger
  {
    id: "above-center",
    offsetY: -ORIGIN_OFFSET_PX,
    originX: "center",
    originY: "top",
    overlayX: "center",
    overlayY: "bottom",
    panelClass: ["bit-tooltip-above-center"],
  },
];
