import { ConnectedPosition } from "@angular/cdk/overlay";

export type MenuPositionIdentifier = "below-start" | "below-end" | "above-start" | "above-end";

export interface DefaultMenuPosition extends ConnectedPosition {
  id: MenuPositionIdentifier;
}

/**
 * Order matters: CDK uses the first position that fits within the viewport.
 * Today's default is below-start; consumers can opt into any of the others
 * via `[menuPosition]` on `bitMenuTriggerFor`.
 */
export const defaultPositions: DefaultMenuPosition[] = [
  { id: "below-start", originX: "start", originY: "bottom", overlayX: "start", overlayY: "top" },
  { id: "below-end", originX: "end", originY: "bottom", overlayX: "end", overlayY: "top" },
  { id: "above-start", originX: "start", originY: "top", overlayX: "start", overlayY: "bottom" },
  { id: "above-end", originX: "end", originY: "top", overlayX: "end", overlayY: "bottom" },
];
