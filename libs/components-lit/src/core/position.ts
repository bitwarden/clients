export type Side = "top" | "bottom" | "start" | "end";
export type Align = "center" | "start" | "end";
/** e.g. `"bottom-start"`. Inline sides are logical and flip in RTL. */
export type Placement = `${Side}-${Align}`;

export type PositionOptions = {
  /** Candidates in priority order; the first that fits the viewport wins. */
  placements: Placement[];
  /** Gap between anchor and floating element, in px. */
  offset?: number;
  /** Minimum distance from the viewport edge, in px. */
  viewportMargin?: number;
  /** Match the floating element's width to the anchor's. */
  matchWidth?: boolean;
};

export type PositionResult = { placement: Placement; x: number; y: number };

function isRtl(el: Element) {
  return getComputedStyle(el).direction === "rtl";
}

function toPhysical(side: Side, rtl: boolean): "top" | "bottom" | "left" | "right" {
  if (side === "start") {
    return rtl ? "right" : "left";
  }
  if (side === "end") {
    return rtl ? "left" : "right";
  }
  return side;
}

function coords(
  anchor: DOMRect,
  floating: DOMRect,
  placement: Placement,
  offset: number,
  rtl: boolean,
) {
  const [side, align] = placement.split("-") as [Side, Align];
  const physical = toPhysical(side, rtl);
  let x = 0;
  let y = 0;

  if (physical === "top" || physical === "bottom") {
    y = physical === "top" ? anchor.top - floating.height - offset : anchor.bottom + offset;
    const startX = rtl ? anchor.right - floating.width : anchor.left;
    const endX = rtl ? anchor.left : anchor.right - floating.width;
    x =
      align === "center"
        ? anchor.left + (anchor.width - floating.width) / 2
        : align === "start"
          ? startX
          : endX;
  } else {
    x = physical === "left" ? anchor.left - floating.width - offset : anchor.right + offset;
    y =
      align === "center"
        ? anchor.top + (anchor.height - floating.height) / 2
        : align === "start"
          ? anchor.top
          : anchor.bottom - floating.height;
  }
  return { x, y };
}

/**
 * Positions `floating` (which must be `position: fixed`, typically a `popover` in the top layer)
 * relative to `anchor`. Tries each placement in order, falling back to the first one clamped into
 * the viewport.
 */
export function computePosition(
  anchor: Element,
  floating: HTMLElement,
  { placements, offset = 0, viewportMargin = 8, matchWidth = false }: PositionOptions,
): PositionResult {
  const anchorRect = anchor.getBoundingClientRect();
  if (matchWidth) {
    floating.style.minWidth = `${anchorRect.width}px`;
  }
  const floatingRect = floating.getBoundingClientRect();
  const rtl = isRtl(anchor);
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;

  const fits = ({ x, y }: { x: number; y: number }) =>
    x >= viewportMargin &&
    y >= viewportMargin &&
    x + floatingRect.width <= vw - viewportMargin &&
    y + floatingRect.height <= vh - viewportMargin;

  let chosen = placements[0];
  let point = coords(anchorRect, floatingRect, chosen, offset, rtl);
  for (const placement of placements) {
    const candidate = coords(anchorRect, floatingRect, placement, offset, rtl);
    if (fits(candidate)) {
      chosen = placement;
      point = candidate;
      break;
    }
  }

  const x = Math.min(
    Math.max(point.x, viewportMargin),
    Math.max(viewportMargin, vw - floatingRect.width - viewportMargin),
  );
  const y = Math.min(
    Math.max(point.y, viewportMargin),
    Math.max(viewportMargin, vh - floatingRect.height - viewportMargin),
  );

  floating.style.left = `${x}px`;
  floating.style.top = `${y}px`;
  floating.dataset.placement = chosen;
  return { placement: chosen, x, y };
}

/**
 * Re-runs `update` when the anchor or floating element may have moved: scroll in any ancestor,
 * viewport resize, or either element resizing. Returns a cleanup function.
 */
export function autoUpdate(anchor: Element, floating: HTMLElement, update: () => void): () => void {
  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  };
  const resizeObserver = new ResizeObserver(schedule);
  resizeObserver.observe(anchor);
  resizeObserver.observe(floating);
  window.addEventListener("scroll", schedule, { capture: true, passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  update();

  return () => {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    window.removeEventListener("scroll", schedule, { capture: true });
    window.removeEventListener("resize", schedule);
  };
}
