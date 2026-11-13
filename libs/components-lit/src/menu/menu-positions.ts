import { Placement } from "../core/position";

export type MenuPosition = "below-start" | "below-end" | "above-start" | "above-end";

const placements: Record<MenuPosition, Placement> = {
  "below-start": "bottom-start",
  "below-end": "bottom-end",
  "above-start": "top-start",
  "above-end": "top-end",
};

/** Default order; the first that fits the viewport wins. */
const defaultOrder: MenuPosition[] = ["below-start", "below-end", "above-start", "above-end"];

/** Placements with `preferred` first. */
export function menuPlacements(preferred?: MenuPosition): Placement[] {
  const order = preferred
    ? [preferred, ...defaultOrder.filter((position) => position !== preferred)]
    : defaultOrder;
  return order.map((position) => placements[position]);
}

export const MENU_TRIGGER_GAP_PX = 4;
/** 16px from every viewport edge. */
export const MENU_VIEWPORT_MARGIN_PX = 16;
