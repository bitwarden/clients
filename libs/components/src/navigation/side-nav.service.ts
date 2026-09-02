import { computed, inject, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { BehaviorSubject, Observable, fromEvent, map, startWith, debounceTime, first } from "rxjs";

import { BIT_SIDE_NAV_DISK, GlobalStateProvider, KeyDefinition } from "@bitwarden/state";

import { getRootFontSizePx } from "../shared";

const BIT_SIDE_NAV_WIDTH_KEY_DEF = new KeyDefinition<number>(BIT_SIDE_NAV_DISK, "side-nav-width", {
  deserializer: (s) => s,
});

export type SideNavVersion = "default" | "vfo1";

@Injectable({
  providedIn: "root",
})
export class SideNavService {
  // Units in rem
  readonly DEFAULT_OPEN_WIDTH = 18.5; // 296px
  readonly MIN_OPEN_WIDTH = 15; // 240px
  readonly MAX_OPEN_WIDTH = 37.5; // 600px
  readonly SNAP_TO_CLOSED_THRESHOLD = 4; // 48px — ~192px of tension past the 240px minimum

  /** Width of the collapsed nav (icon strip / side rail), in rem. */
  readonly CLOSED_WIDTH = 4;

  /**
   * How many pixels past CLOSED_WIDTH the drag must reach before open-state styling
   * is applied (labels, logo, sections). The nav's physical width continues to be driven
   * by dragDisplayWidth until MIN_OPEN_WIDTH is crossed.
   */
  private readonly OPEN_STYLE_THRESHOLD_PX = 80;

  /**
   * Minimum main content width in rem used to estimate push mode from window.innerWidth.
   * Must match MAIN_MIN_WIDTH_REM in layout.component.ts.
   */
  private readonly MAIN_MIN_WIDTH_ESTIMATE_REM = 24;

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

  /** True after the disk width has been loaded, used to gate transitions alongside layoutReady. */
  private readonly widthInitialized = signal(false);

  /**
   * True after one setTimeout following the layout's first ResizeObserver callback.
   * This ensures the initial open/width state has been painted before transitions are
   * enabled, preventing the nav from animating in on page load.
   */
  private readonly layoutReady = signal(false);

  /** True when it is safe to animate width changes. */
  readonly transitionsEnabled = computed(() => this.widthInitialized() && this.layoutReady());

  /**
   * Visual width (in rem) to apply during a drag from a closed state, before MIN_OPEN_WIDTH
   * is crossed. Drives the nav's display width via a direct style binding without changing
   * the `open` signal, so no component adopts open-state styling until the threshold is
   * actually crossed. Null when not in a preview drag.
   */
  readonly dragDisplayWidth = signal<number | null>(null);

  /** Local width state. GlobalStateProvider is authoritative and applied once resolved. */
  private readonly _width$ = new BehaviorSubject<number>(this.DEFAULT_OPEN_WIDTH);
  readonly width$ = this._width$.asObservable();

  /** Current nav width as a signal, for use in grid column calculations. */
  readonly widthRem = toSignal(this.width$, { initialValue: this.DEFAULT_OPEN_WIDTH });

  /** Authoritative persisted width from GlobalStateProvider. */
  private readonly widthState = inject(GlobalStateProvider).get(BIT_SIDE_NAV_WIDTH_KEY_DEF);
  readonly widthState$ = this.widthState.state$.pipe(
    map((width) => width ?? this.DEFAULT_OPEN_WIDTH),
  );

  constructor() {
    // Get computed root font size to support user-defined a11y font increases
    this.rootFontSizePx = getRootFontSizePx();

    // Estimate the initial open state from window.innerWidth so the first render shows
    // the correct layout before LayoutComponent's ResizeObserver fires.
    const estimatedPushMode =
      window.innerWidth - this.DEFAULT_OPEN_WIDTH * this.rootFontSizePx >=
      this.MAIN_MIN_WIDTH_ESTIMATE_REM * this.rootFontSizePx;
    if (estimatedPushMode) {
      this.open.set(true);
    }

    // Sync from GlobalStateProvider (authoritative source of truth).
    this.widthState$.pipe(first()).subscribe((diskWidth: number) => {
      this._width$.next(diskWidth);
      this.widthInitialized.set(true);
    });

    // Periodically sync to GlobalStateProvider when component state changes.
    this.width$.pipe(debounceTime(200), takeUntilDestroyed()).subscribe((width) => {
      void this.widthState.update(() => width);
    });
  }

  /**
   * Called by LayoutComponent after its first ResizeObserver callback completes.
   * Schedules enabling CSS transitions after the initialized state is painted.
   */
  markLayoutReady() {
    if (!this.layoutReady()) {
      setTimeout(() => this.layoutReady.set(true));
    }
  }

  /**
   * Toggle the open/close state of the side nav
   */
  toggle() {
    const opening = !this.open();
    this.userCollapsePreference.set(opening ? "open" : "closed");
    this.open.set(opening);

    if (opening && this._width$.getValue() < this.MIN_OPEN_WIDTH) {
      this._width$.next(this.DEFAULT_OPEN_WIDTH);
    }
  }

  /**
   * Set new side nav width from drag event coordinates
   *
   * @param eventXCoordinate x coordinate of the pointer's bounding client rect
   * @param dragElementXCoordinate x coordinate of the drag element's bounding client rect
   */
  setWidthFromDrag(eventXPointer: number, dragElementXCoordinate: number) {
    this.isDragging.set(true);

    const newWidthInPixels = eventXPointer - dragElementXCoordinate;
    const newWidthInRem = newWidthInPixels / this.rootFontSizePx;

    if (this.dragDisplayWidth() !== null || !this.open()) {
      // Dragging from collapsed state — drive visual width via dragDisplayWidth without
      // changing `open`, so no component adopts open-state styling prematurely.
      if (newWidthInRem < this.CLOSED_WIDTH) {
        this.open.set(false);
        return;
      }

      if (newWidthInRem >= this.MIN_OPEN_WIDTH) {
        // Fully crossed the minimum — commit to genuinely open, hand width to _width$
        this.dragDisplayWidth.set(null);
        this.userCollapsePreference.set("open");
        this.open.set(true);
        this._setWidthWithinMinMax(newWidthInRem);
      } else {
        // Drive visual width via dragDisplayWidth; flip open styles once 50px past closed
        const openStyleThresholdRem =
          this.CLOSED_WIDTH + this.OPEN_STYLE_THRESHOLD_PX / this.rootFontSizePx;
        this.open.set(newWidthInRem >= openStyleThresholdRem);
        this.dragDisplayWidth.set(newWidthInRem);
      }
      return;
    }

    // Snap to collapsed only after dragging far enough past the minimum (tension zone)
    if (newWidthInRem < this.SNAP_TO_CLOSED_THRESHOLD) {
      this.userCollapsePreference.set("closed");
      this.open.set(false);
      return;
    }

    // Tension zone: visually shrink at half speed to signal the snap threshold is approaching
    if (newWidthInRem < this.MIN_OPEN_WIDTH) {
      const overflow = this.MIN_OPEN_WIDTH - newWidthInRem;
      this._width$.next(this.MIN_OPEN_WIDTH - overflow * 0.15);
      return;
    }

    this._setWidthWithinMinMax(newWidthInRem);
  }

  /**
   * Set new side nav width from arrow key events
   *
   * @param key event key, must be either ArrowRight or ArrowLeft
   */
  setWidthFromKeys(key: "ArrowRight" | "ArrowLeft") {
    if (key === "ArrowRight" && !this.open()) {
      this.userCollapsePreference.set("open");
      this.open.set(true);
      this._width$.next(this.DEFAULT_OPEN_WIDTH);
      return;
    }

    const currentWidth = this._width$.getValue();

    const delta = key === "ArrowLeft" ? -1 : 1;
    const newWidth = currentWidth + delta;

    this._setWidthWithinMinMax(newWidth);
  }

  /**
   * Called when a drag ends. If released in the tension zone, spring back to the minimum width.
   * If released during a preview open, revert the nav to closed.
   */
  onDragEnd() {
    this.isDragging.set(false);

    if (this.dragDisplayWidth() !== null) {
      // Released in preview zone — commit to open at default width
      this.dragDisplayWidth.set(null);
      this.userCollapsePreference.set("open");
      this.open.set(true);
      this._width$.next(this.DEFAULT_OPEN_WIDTH);
      return;
    }

    if (this.open() && this._width$.getValue() < this.MIN_OPEN_WIDTH) {
      this._width$.next(this.MIN_OPEN_WIDTH);
    }
  }

  /**
   * Calculate and set the new width, not going out of the min/max bounds
   * @param newWidth desired new width: number
   */
  private _setWidthWithinMinMax(newWidth: number) {
    const width = Math.min(Math.max(newWidth, this.MIN_OPEN_WIDTH), this.MAX_OPEN_WIDTH);

    this._width$.next(width);
  }
}

/**
 * Helper function for subscribing to media query events
 * @param query media query to validate against
 * @returns Observable<boolean>
 */
export const media = (query: string): Observable<boolean> => {
  const mediaQuery = window.matchMedia(query);
  return fromEvent<MediaQueryList>(mediaQuery, "change").pipe(
    startWith(mediaQuery),
    map((list: MediaQueryList) => list.matches),
  );
};
