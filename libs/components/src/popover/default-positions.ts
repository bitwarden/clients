import { ConnectedPosition } from "@angular/cdk/overlay";

const ORIGIN_OFFSET_PX = 6;
const OVERLAY_OFFSET_PX = 24;

export type PositionIdentifier =
  | "right-start"
  | "right-center"
  | "right-end"
  | "left-start"
  | "left-center"
  | "left-end"
  | "below-start"
  | "below-center"
  | "below-end"
  | "above-start"
  | "above-center"
  | "above-end";

export interface DefaultPosition extends ConnectedPosition {
  id: PositionIdentifier;
}

export const defaultPositions: DefaultPosition[] = [
  /**
   * The order of these positions matters. The Popover component will use
   * the first position that fits within the viewport.
   */

  // Popover opens to right of trigger
  {
    id: "right-start",
    offsetX: ORIGIN_OFFSET_PX,
    offsetY: -OVERLAY_OFFSET_PX,
    originX: "end",
    originY: "center",
    overlayX: "start",
    overlayY: "top",
    panelClass: ["bit-popover-right", "bit-popover-right-start"],
  },
  {
    id: "right-center",
    offsetX: ORIGIN_OFFSET_PX,
    originX: "end",
    originY: "center",
    overlayX: "start",
    overlayY: "center",
    panelClass: ["bit-popover-right", "bit-popover-right-center"],
  },
  {
    id: "right-end",
    offsetX: ORIGIN_OFFSET_PX,
    offsetY: OVERLAY_OFFSET_PX,
    originX: "end",
    originY: "center",
    overlayX: "start",
    overlayY: "bottom",
    panelClass: ["bit-popover-right", "bit-popover-right-end"],
  },
  // ... to left of trigger
  {
    id: "left-start",
    offsetX: -ORIGIN_OFFSET_PX,
    offsetY: -OVERLAY_OFFSET_PX,
    originX: "start",
    originY: "center",
    overlayX: "end",
    overlayY: "top",
    panelClass: ["bit-popover-left", "bit-popover-left-start"],
  },
  {
    id: "left-center",
    offsetX: -ORIGIN_OFFSET_PX,
    originX: "start",
    originY: "center",
    overlayX: "end",
    overlayY: "center",
    panelClass: ["bit-popover-left", "bit-popover-left-center"],
  },
  {
    id: "left-end",
    offsetX: -ORIGIN_OFFSET_PX,
    offsetY: OVERLAY_OFFSET_PX,
    originX: "start",
    originY: "center",
    overlayX: "end",
    overlayY: "bottom",
    panelClass: ["bit-popover-left", "bit-popover-left-end"],
  },
  // ... below trigger
  {
    id: "below-center",
    offsetY: ORIGIN_OFFSET_PX,
    originX: "center",
    originY: "bottom",
    overlayX: "center",
    overlayY: "top",
    panelClass: ["bit-popover-below", "bit-popover-below-center"],
  },
  {
    id: "below-start",
    offsetX: -OVERLAY_OFFSET_PX,
    offsetY: ORIGIN_OFFSET_PX,
    originX: "center",
    originY: "bottom",
    overlayX: "start",
    overlayY: "top",
    panelClass: ["bit-popover-below", "bit-popover-below-start"],
  },
  {
    id: "below-end",
    offsetX: OVERLAY_OFFSET_PX,
    offsetY: ORIGIN_OFFSET_PX,
    originX: "center",
    originY: "bottom",
    overlayX: "end",
    overlayY: "top",
    panelClass: ["bit-popover-below", "bit-popover-below-end"],
  },
  // ... above trigger
  {
    id: "above-center",
    offsetY: -ORIGIN_OFFSET_PX,
    originX: "center",
    originY: "top",
    overlayX: "center",
    overlayY: "bottom",
    panelClass: ["bit-popover-above", "bit-popover-above-center"],
  },
  {
    id: "above-start",
    offsetX: -OVERLAY_OFFSET_PX,
    offsetY: -ORIGIN_OFFSET_PX,
    originX: "center",
    originY: "top",
    overlayX: "start",
    overlayY: "bottom",
    panelClass: ["bit-popover-above", "bit-popover-above-start"],
  },
  {
    id: "above-end",
    offsetX: OVERLAY_OFFSET_PX,
    offsetY: -ORIGIN_OFFSET_PX,
    originX: "center",
    originY: "top",
    overlayX: "end",
    overlayY: "bottom",
    panelClass: ["bit-popover-above", "bit-popover-above-end"],
  },
];
