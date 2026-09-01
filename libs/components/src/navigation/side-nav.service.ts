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
  readonly SNAP_TO_CLOSED_THRESHOLD = 2; // 32px — ~208px of tension past the 240px minimum

  /**
   * Width of the collapsed nav (icon strip / siderail).
   *
   * Applied explicitly when closed because the v2 layout's content lives inside a
   * `container-type: size` element, which reports zero intrinsic width and would
   * otherwise let the nav collapse to nothing. Matches the siderail width the layout
   * reserves for the closed nav.
   */
  readonly CLOSED_WIDTH = 4;

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

  /**
   * True while the user is dragging from a collapsed state but hasn't yet crossed
   * MIN_OPEN_WIDTH. The nav is temporarily opened so _width$ can drive its visual width
   * using the same BehaviorSubject path as the working open-state resize.
   * Reverted to closed on drag end if the user releases before the threshold.
   */
  private readonly _previewOpen = signal(false);

  /**
   * Local component state width
   *
   * This observable has immediate pixel-perfect updates for the sidebar display width to use
   */
  private readonly _width$ = new BehaviorSubject<number>(this.DEFAULT_OPEN_WIDTH);
  readonly width$ = this._width$.asObservable();

  /** Current nav width as a signal, for use in grid column calculations. */
  readonly widthRem = toSignal(this.width$, { initialValue: this.DEFAULT_OPEN_WIDTH });

  /**
   * State provider width
   *
   * This observable is used to initialize the component state and will be periodically synced
   * to the local _width$ state to avoid excessive writes
   */
  private readonly widthState = inject(GlobalStateProvider).get(BIT_SIDE_NAV_WIDTH_KEY_DEF);
  readonly widthState$ = this.widthState.state$.pipe(
    map((width) => width ?? this.DEFAULT_OPEN_WIDTH),
  );

  constructor() {
    // Get computed root font size to support user-defined a11y font increases
    this.rootFontSizePx = getRootFontSizePx();

    // Initialize the resizable width from state provider
    this.widthState$.pipe(first()).subscribe((width: number) => {
      this._width$.next(width);
    });

    // Periodically sync to state provider when component state changes
    this.width$.pipe(debounceTime(200), takeUntilDestroyed()).subscribe((width) => {
      void this.widthState.update(() => width);
    });
  }

  /**
   * Toggle the open/close state of the side nav
   */
  toggle() {
    this.userCollapsePreference.set(this.open() ? "closed" : "open");
    this.open.set(!this.open());
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

    if (this._previewOpen() || !this.open()) {
      // Dragging from collapsed state — show immediate feedback by temporarily opening
      // the nav and driving width via _width$, the same path used by open-state resize.
      if (newWidthInRem < this.CLOSED_WIDTH) {
        return;
      }

      if (newWidthInRem >= this.MIN_OPEN_WIDTH) {
        // Crossed the threshold — commit to genuinely open
        this._previewOpen.set(false);
        this.userCollapsePreference.set("open");
        this.open.set(true);
        this._setWidthWithinMinMax(newWidthInRem);
      } else {
        // Still in preview zone — open temporarily and track cursor width
        if (!this._previewOpen()) {
          this._previewOpen.set(true);
          this.open.set(true);
        }
        this._width$.next(newWidthInRem);
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
      this._width$.next(this.MIN_OPEN_WIDTH - overflow * 0.075);
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

    if (this._previewOpen()) {
      // User started dragging to expand — commit to open at default width
      this._previewOpen.set(false);
      this.userCollapsePreference.set("open");
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
