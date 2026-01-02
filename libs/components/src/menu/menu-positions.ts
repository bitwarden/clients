import { ConnectedPosition } from "@angular/cdk/overlay";

export type MenuPositionIdentifier =
  | "below-left"
  | "below-right"
  | "above-left"
  | "above-right"
  | "right-top"
  | "right-bottom"
  | "left-top"
  | "left-bottom";

export interface MenuPosition extends ConnectedPosition {
  id: MenuPositionIdentifier;
}

export const menuPositions: MenuPosition[] = [
  /**
   * The order of these positions matters. The Menu component will use
   * the first position that fits within the viewport.
   */

  // Menu opens below trigger, aligned to left edge
  {
    id: "below-left",
    originX: "start",
    originY: "bottom",
    overlayX: "start",
    overlayY: "top",
  },
  // Menu opens below trigger, aligned to right edge
  {
    id: "below-right",
    originX: "end",
    originY: "bottom",
    overlayX: "end",
    overlayY: "top",
  },
  // Menu opens above trigger, aligned to left edge
  {
    id: "above-left",
    originX: "start",
    originY: "top",
    overlayX: "start",
    overlayY: "bottom",
  },
  // Menu opens above trigger, aligned to right edge
  {
    id: "above-right",
    originX: "end",
    originY: "top",
    overlayX: "end",
    overlayY: "bottom",
  },
  // Menu opens to right of trigger, aligned to top edge (for submenus)
  {
    id: "right-top",
    originX: "end",
    originY: "top",
    overlayX: "start",
    overlayY: "top",
  },
  // Menu opens to right of trigger, aligned to bottom edge (for submenus)
  {
    id: "right-bottom",
    originX: "end",
    originY: "bottom",
    overlayX: "start",
    overlayY: "bottom",
  },
  // Menu opens to left of trigger, aligned to top edge (for submenus)
  {
    id: "left-top",
    originX: "start",
    originY: "top",
    overlayX: "end",
    overlayY: "top",
  },
  // Menu opens to left of trigger, aligned to bottom edge (for submenus)
  {
    id: "left-bottom",
    originX: "start",
    originY: "bottom",
    overlayX: "end",
    overlayY: "bottom",
  },
];
