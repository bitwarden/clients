import { computed, inject, Injectable, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Observable, fromEvent, map, startWith } from "rxjs";

import { getRootFontSizePx, MAIN_MIN_WIDTH_REM, SIDERAIL_WIDTH_REM } from "../shared";

import { SIDE_NAV_WIDTH_BOUNDS, SideNavWidthService } from "./side-nav-width.service";

export type SideNavVersion = "default" | "vfo1";

@Injectable({
  providedIn: "root",
})
export class SideNavService {
  // Units in rem. Bounds live in side-nav-width.service.ts, which enforces them.
  readonly DEFAULT_OPEN_WIDTH = SIDE_NAV_WIDTH_BOUNDS.default;
  readonly MIN_OPEN_WIDTH = SIDE_NAV_WIDTH_BOUNDS.min;
  readonly MAX_OPEN_WIDTH = SIDE_NAV_WIDTH_BOUNDS.max;
  readonly SNAP_TO_CLOSED_THRESHOLD = 4; // 64px — 176px of tension past the 240px minimum

  /** Width of the collapsed nav (icon strip / side rail), in rem. */
  readonly CLOSED_WIDTH = SIDERAIL_WIDTH_REM;

  private rootFontSizePx: number;

  readonly version = signal<SideNavVersion>("default");

  /**
   * Whether the side navigation is open or closed.
   */
  readonly open = signal(false);

  /**
   * Whether the nav is in push mode (occupies its own grid column).
   * Set by LayoutComponent via ResizeObserver.
   */
  readonly isPushMode = signal(false);

  /**
   * Widest the nav can be (in rem) while still leaving main content its minimum width.
   * Set by LayoutComponent via ResizeObserver; Infinity until first measured.
   */
  readonly maxPushWidthRem = signal(Infinity);

  /**
   * True when the nav is open but not in push mode — it overlays the content.
   */
  readonly isOverlay = computed(() => this.open() && !this.isPushMode());

  /**
   * Explicit user preference for open/closed state, set when the user manually
   * toggles the nav. Null means no preference (auto-open when push mode allows).
   */
  readonly userCollapsePreference = signal<"open" | "closed" | null>(null);

  /** True while the user is actively dragging the resize handle. Disables CSS transitions during drag. */
  readonly isDragging = signal(false);

  /**
   * True one tick after the layout's first ResizeObserver callback, so the initial open/width
   * state is painted before transitions turn on and the nav does not animate in on page load.
   */
  private readonly layoutReady = signal(false);

  /** True once the initial width and layout have settled, so width changes may animate. */
  readonly transitionsEnabled = computed(() => this.widthService.hydrated() && this.layoutReady());

  /**
   * Visual width override (in rem) applied during a drag via a direct style binding: the preview
   * below MIN_OPEN_WIDTH when dragging out from collapsed, and the tension shrink when an open nav
   * is dragged toward the snap threshold. Drives width alone — the nav keeps its closed styling
   * until it actually opens. Never persisted. Null when no drag is in progress.
   */
  readonly dragDisplayWidth = signal<number | null>(null);

  /** Owns the width and decides what is persisted. This service never writes to disk itself. */
  private readonly widthService = inject(SideNavWidthService);

  readonly width$ = this.widthService.width$;

  /** Current nav width as a signal, for use in grid column calculations. */
  readonly widthRem = toSignal(this.width$, { initialValue: SIDE_NAV_WIDTH_BOUNDS.default });

  constructor() {
    // Get computed root font size to support user-defined a11y font increases
    this.rootFontSizePx = getRootFontSizePx();

    // Estimate the initial open state from window.innerWidth so the first render shows
    // the correct layout before LayoutComponent's ResizeObserver fires.
    const estimatedPushMode =
      window.innerWidth - this.DEFAULT_OPEN_WIDTH * this.rootFontSizePx >=
      MAIN_MIN_WIDTH_REM * this.rootFontSizePx;
    if (estimatedPushMode) {
      this.open.set(true);
    }
  }

  /** Called by LayoutComponent after its first ResizeObserver callback, to enable transitions once painted. */
  markLayoutReady() {
    if (!this.layoutReady()) {
      setTimeout(() => this.layoutReady.set(true));
    }
  }

  /** Toggle the open/close state of the side nav. */
  toggle() {
    if (this.open()) {
      this.userCollapsePreference.set("closed");
      this.open.set(false);
      return;
    }

    this._expand();
  }

  /**
   * Set new side nav width from drag event coordinates.
   *
   * @param eventXPointer x coordinate of the pointer
   * @param dragElementXCoordinate x coordinate of the drag element's bounding client rect
   */
  setWidthFromDrag(eventXPointer: number, dragElementXCoordinate: number) {
    this.isDragging.set(true);

    const newWidthInPixels = eventXPointer - dragElementXCoordinate;
    const newWidthInRem = newWidthInPixels / this.rootFontSizePx;

    if (!this.open()) {
      // Dragging out from collapsed — drive visual width via dragDisplayWidth without changing
      // `open`, so push/overlay mode and open-state styling stay put until the drag commits.
      if (newWidthInRem < this.CLOSED_WIDTH) {
        // Dragged back onto the icon strip — abort the preview and stay collapsed.
        this.dragDisplayWidth.set(null);
        return;
      }

      if (newWidthInRem >= this.MIN_OPEN_WIDTH) {
        // Fully crossed the minimum — commit to genuinely open, hand width to _width$
        this.dragDisplayWidth.set(null);
        this.userCollapsePreference.set("open");
        this.open.set(true);
        this._setWidthWithinMinMax(newWidthInRem);
      } else {
        this.dragDisplayWidth.set(newWidthInRem);
      }
      return;
    }

    // Snap to collapsed only after dragging far enough past the minimum (tension zone)
    if (newWidthInRem < this.SNAP_TO_CLOSED_THRESHOLD) {
      this.dragDisplayWidth.set(null);
      this.userCollapsePreference.set("closed");
      this.open.set(false);
      return;
    }

    // Tension zone: preview a 15% shrink to signal the approaching snap threshold. This stays in
    // dragDisplayWidth so a drag that ends collapsed leaves the user's saved width untouched.
    if (newWidthInRem < this.MIN_OPEN_WIDTH) {
      const overflow = this.MIN_OPEN_WIDTH - newWidthInRem;
      this.dragDisplayWidth.set(this.MIN_OPEN_WIDTH - overflow * 0.15);
      return;
    }

    this.dragDisplayWidth.set(null);
    this._setWidthWithinMinMax(newWidthInRem);
  }

  /**
   * Set new side nav width from arrow key events. The collapsed state is the low end of the
   * range, so the arrows cross the collapse boundary in both directions.
   *
   * @param key event key, must be either ArrowRight or ArrowLeft
   */
  setWidthFromKeys(key: "ArrowRight" | "ArrowLeft") {
    if (!this.open()) {
      // Already at the low end — only ArrowRight moves off it.
      if (key === "ArrowRight") {
        this._expand();
      }
      return;
    }

    const currentWidth = this.widthRem();

    // Stepping left off the minimum collapses, mirroring the drag snap.
    if (key === "ArrowLeft" && currentWidth <= this.MIN_OPEN_WIDTH) {
      this.userCollapsePreference.set("closed");
      this.open.set(false);
      return;
    }

    const delta = key === "ArrowLeft" ? -1 : 1;
    const newWidth = currentWidth + delta;

    this._setWidthWithinMinMax(newWidth);
  }

  /**
   * Called when a drag ends. Release is what turns a provisional preview into a decision:
   * released open in the tension zone commits the minimum, since the user dragged past a bound;
   * released collapsed or aborted only clears the preview, since collapsing says nothing about
   * width; released in the collapsed preview zone reopens at the width the user already had.
   */
  onDragEnd() {
    this.isDragging.set(false);

    const preview = this.dragDisplayWidth();
    this.dragDisplayWidth.set(null);

    if (preview === null) {
      return;
    }

    if (this.open()) {
      // Released in the tension zone — spring back to the minimum.
      this.widthService.commit(this.MIN_OPEN_WIDTH);
      return;
    }

    // Released in the collapsed preview zone — open at the width the user already had.
    this._expand();
  }

  /**
   * Open the nav at the width the user last chose. Display-only: restoring a saved width is not a
   * new preference, so nothing is persisted and a later collapse still returns to the same width.
   */
  private _expand() {
    this.userCollapsePreference.set("open");
    this.open.set(true);
    this.widthService.display(this._pushClamped(this.widthService.saved()));
  }

  /** Commit the width, held within bounds and within what the container can push. */
  private _setWidthWithinMinMax(newWidth: number) {
    this.widthService.commit(this._pushClamped(newWidth));
  }

  /**
   * Narrow `width` to what the container can push, so main content is never clipped. Display-only:
   * a container limit is not a preference, so this must not decide what gets persisted.
   */
  private _pushClamped(width: number) {
    const max = Math.max(
      this.MIN_OPEN_WIDTH,
      Math.min(this.MAX_OPEN_WIDTH, this.maxPushWidthRem()),
    );
    return Math.min(width, max);
  }
}

/** Emits whether `query` matches, starting with its current value. */
export const media = (query: string): Observable<boolean> => {
  const mediaQuery = window.matchMedia(query);
  return fromEvent<MediaQueryList>(mediaQuery, "change").pipe(
    startWith(mediaQuery),
    map((list: MediaQueryList) => list.matches),
  );
};
