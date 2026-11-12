/** `<side>-<alignment>`. `right`/`left` are logical: they flip in RTL, like the CDK's `end`/`start`. */
export type PopoverPosition =
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

/** The first position that fits the viewport wins. Order matches `libs/components`. */
export const defaultPopoverPositions: readonly PopoverPosition[] = [
  "right-start",
  "right-center",
  "right-end",
  "left-start",
  "left-center",
  "left-end",
  "below-center",
  "below-start",
  "below-end",
  "above-center",
  "above-start",
  "above-end",
];

/** Gap between the anchor and the popover, leaving room for the arrow. */
const ORIGIN_OFFSET_PX = 14;
/** Distance from the popover's edge to its arrow, so the arrow points at the anchor's center. */
const OVERLAY_OFFSET_PX = 24;

function coords(
  anchor: DOMRect,
  width: number,
  height: number,
  position: PopoverPosition,
  rtl: boolean,
) {
  const [side, align] = position.split("-") as [string, "start" | "center" | "end"];
  const centerX = anchor.left + anchor.width / 2;
  const centerY = anchor.top + anchor.height / 2;

  if (side === "right" || side === "left") {
    const physicalRight = (side === "right") !== rtl;
    const x = physicalRight
      ? anchor.right + ORIGIN_OFFSET_PX
      : anchor.left - ORIGIN_OFFSET_PX - width;
    const y =
      align === "start"
        ? centerY - OVERLAY_OFFSET_PX
        : align === "end"
          ? centerY + OVERLAY_OFFSET_PX - height
          : centerY - height / 2;
    return { x, y };
  }

  const y =
    side === "below" ? anchor.bottom + ORIGIN_OFFSET_PX : anchor.top - ORIGIN_OFFSET_PX - height;
  const startEdgeLeft = (align === "start") !== rtl;
  const x =
    align === "center"
      ? centerX - width / 2
      : startEdgeLeft
        ? centerX - OVERLAY_OFFSET_PX
        : centerX + OVERLAY_OFFSET_PX - width;
  return { x, y };
}

/** Candidate list with `preferred` first, as `bitPopoverAnchorFor`'s `position` input does. */
export function popoverPositionsFor(preferred?: PopoverPosition): PopoverPosition[] {
  return preferred ? [preferred, ...defaultPopoverPositions] : [...defaultPopoverPositions];
}

/**
 * Places `floating` (`position: fixed`) next to `anchor`, using the first candidate that fits the
 * viewport, then pushing it on-screen. Pass a single candidate to keep a locked position.
 *
 * Popovers point their arrow at the anchor's center with fixed offsets (the CDK's
 * `offsetX`/`offsetY`), which `computePosition`'s edge alignment can't express.
 */
export function positionPopover(
  anchor: Element,
  floating: HTMLElement,
  candidates: PopoverPosition[],
): PopoverPosition {
  const anchorRect = anchor.getBoundingClientRect();
  const { width, height } = floating.getBoundingClientRect();
  const rtl = getComputedStyle(anchor).direction === "rtl";
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const fits = ({ x, y }: { x: number; y: number }) =>
    x >= 0 && y >= 0 && x + width <= vw && y + height <= vh;

  let chosen = candidates[0];
  let point = coords(anchorRect, width, height, chosen, rtl);
  for (const candidate of candidates) {
    const next = coords(anchorRect, width, height, candidate, rtl);
    if (fits(next)) {
      chosen = candidate;
      point = next;
      break;
    }
  }

  floating.style.left = `${Math.min(Math.max(point.x, 0), Math.max(0, vw - width))}px`;
  floating.style.top = `${Math.min(Math.max(point.y, 0), Math.max(0, vh - height))}px`;
  return chosen;
}
