/** Which way the user is currently moving through a scrollable region. */
export type ScrollDirection = "up" | "down";

export type ScrollDirectionOptions = {
  /**
   * Pixels of travel required to flip direction. Filters out the sub-pixel and trackpad jitter that
   * would otherwise make the reported direction thrash.
   */
  threshold?: number;

  /** Within this many pixels of the top, always report `"up"`. */
  topOffset?: number;

  /**
   * Within this many pixels of the bottom, hold `"down"`. Prevents an oscillation loop when a
   * consumer collapses a region in response to `"down"`: the collapse grows the viewport, the
   * browser clamps `scrollTop`, and the smaller offset would otherwise read as `"up"`.
   */
  bottomOffset?: number;

  /**
   * How far the region must be able to scroll before `"down"` is reported at all.
   *
   * Without a floor, a consumer that collapses a region on `"down"` can loop: the collapse gives
   * that height back to the scroll region, and if there wasn't much to scroll to begin with, the
   * browser snaps back to the top — which reads as `"up"`, reopens the region, and starts over.
   *
   * Pass the collapsible height. A callback is re-read on each attempt to flip `"down"`. Collapsing
   * consumers should pass a settled height (see `settledHeight`) rather than a live measurement,
   * which reads an intermediate value while animating.
   */
  minScrollable?: number | (() => number);
};

/** The element under the pointer while a button is held, so scrollbar drags can be detected. */
let pressed: EventTarget | null = null;
const pressListeners = new Set<() => void>();

if (typeof document !== "undefined") {
  document.addEventListener("pointerdown", (event) => (pressed = event.target), { capture: true });
  // `scrollend` covers Chrome skipping `pointerup` after a scrollbar drag.
  const release = () => {
    if (pressed !== null) {
      pressed = null;
      pressListeners.forEach((listener) => listener());
    }
  };
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  document.addEventListener("scrollend", release, { capture: true });
}

/**
 * Tracks the direction an element is being scrolled. Holds its direction while the scrollbar is
 * dragged. Reports `"up"` while there is no element or it isn't scrollable.
 */
export class ScrollDirectionTracker {
  private element: HTMLElement | null = null;
  private _direction: ScrollDirection = "up";
  private anchor = 0;
  private frame?: number;
  private readonly threshold: number;
  private readonly topOffset: number;
  private readonly bottomOffset: number;
  private readonly readMinScrollable: () => number;

  constructor(
    options: ScrollDirectionOptions,
    private readonly onChange: (direction: ScrollDirection) => void,
  ) {
    this.threshold = options.threshold ?? 16;
    this.topOffset = options.topOffset ?? 0;
    this.bottomOffset = options.bottomOffset ?? 24;
    const min = options.minScrollable ?? 0;
    this.readMinScrollable = typeof min === "function" ? min : () => min;
    pressListeners.add(this.onRelease);
  }

  get direction(): ScrollDirection {
    return this._direction;
  }

  setElement(element: HTMLElement | null) {
    if (element === this.element) {
      return;
    }
    this.element?.removeEventListener("scroll", this.onScroll);
    this.element = element;
    this._direction = "up";
    this.anchor = 0;
    element?.addEventListener("scroll", this.onScroll, { passive: true });
    this.evaluate();
    this.onChange(this._direction);
  }

  destroy() {
    this.setElement(null);
    pressListeners.delete(this.onRelease);
    if (this.frame !== undefined) {
      cancelAnimationFrame(this.frame);
    }
  }

  private readonly onRelease = () => this.evaluate();

  private readonly onScroll = () => {
    if (this.frame === undefined) {
      this.frame = requestAnimationFrame(() => {
        this.frame = undefined;
        this.evaluate();
      });
    }
  };

  private evaluate() {
    const element = this.element;
    // A press on the scroller itself is a scrollbar drag, where a collapse would shift the track
    // under the pointer and jump the offset. Release re-evaluates from where the drag began.
    if (!element || pressed === element) {
      return;
    }
    const next = this.next(
      element.scrollTop,
      element.scrollHeight - element.clientHeight,
      element.clientHeight,
    );
    if (next !== this._direction) {
      this._direction = next;
      this.onChange(next);
    }
  }

  private next(top: number, maxTop: number, viewport: number): ScrollDirection {
    const direction = this._direction;
    if (maxTop <= 0 || top <= this.topOffset) {
      this.anchor = top;
      return "up";
    }

    // Gates the flip only. Once `"down"`, the collapsed regions have legitimately reduced
    // `maxTop`, and re-testing it here would expand them again. Equality still fails:
    // giving back exactly `maxTop` leaves nothing to scroll.
    if (direction === "up" && maxTop <= this.readMinScrollable()) {
      this.anchor = top;
      return "up";
    }

    if (top >= maxTop - this.bottomOffset) {
      this.anchor = top;
      return "down";
    }

    const delta = top - this.anchor;

    // A viewport-sized jump is programmatic — a scroll position restore, `scrollIntoView`,
    // or the browser clamping the offset. Re-anchor without reading it as user intent.
    if (Math.abs(delta) >= viewport) {
      this.anchor = top;
      return direction;
    }

    if (Math.abs(delta) <= this.threshold) {
      // Track the extreme so that jitter can't accumulate into a flip.
      this.anchor = direction === "down" ? Math.max(this.anchor, top) : Math.min(this.anchor, top);
      return direction;
    }

    this.anchor = top;
    return delta > 0 ? "down" : "up";
  }
}
