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
  readonly SNAP_TO_CLOSED_THRESHOLD = 4; // 64px — 176px of tension past the 240px minimum

  /** Width of the collapsed nav (icon strip / side rail), in rem. */
  readonly CLOSED_WIDTH = 4;

  /** Pixels past CLOSED_WIDTH a drag must reach before open-state styling (labels, logo, sections) applies. */
  private readonly OPEN_STYLE_THRESHOLD_PX = 80;

  /** Minimum main content width in rem, used to estimate push mode. Must match MAIN_MIN_WIDTH_REM in layout.component.ts. */
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

  /** True after the disk width has been loaded, used to gate transitions alongside layoutReady. */
  private readonly widthInitialized = signal(false);

  /**
   * True one tick after the layout's first ResizeObserver callback, so the initial open/width
   * state is painted before transitions turn on and the nav does not animate in on page load.
   */
  private readonly layoutReady = signal(false);

  /** True once the initial width and layout have settled, so width changes may animate. */
  readonly transitionsEnabled = computed(() => this.widthInitialized() && this.layoutReady());

  /**
   * Visual width override (in rem) applied during a drag via a direct style binding: the preview
   * below MIN_OPEN_WIDTH when dragging out from collapsed, and the tension shrink when an open nav
   * is dragged toward the snap threshold. Never persisted. Null when no drag is in progress.
   */
  readonly dragDisplayWidth = signal<number | null>(null);

  /**
   * Whether to render open-state styling (labels, logo, sections). Distinct from `open`, which also
   * drives push/overlay mode: a preview drag adopts open styling once it is OPEN_STYLE_THRESHOLD_PX
   * past closed, while staying functionally closed until the drag commits.
   */
  readonly showLabels = computed(() => {
    const preview = this.dragDisplayWidth();
    if (preview !== null) {
      return preview >= this.CLOSED_WIDTH + this.OPEN_STYLE_THRESHOLD_PX / this.rootFontSizePx;
    }
    return this.open();
  });

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

    // Persist width changes, debounced so a drag doesn't write once per frame.
    this.width$.pipe(debounceTime(200), takeUntilDestroyed()).subscribe((width) => {
      void this.widthState.update(() => width);
    });
  }

  /** Called by LayoutComponent after its first ResizeObserver callback, to enable transitions once painted. */
  markLayoutReady() {
    if (!this.layoutReady()) {
      setTimeout(() => this.layoutReady.set(true));
    }
  }

  /** Toggle the open/close state of the side nav. */
  toggle() {
    const opening = !this.open();
    this.userCollapsePreference.set(opening ? "open" : "closed");
    this.open.set(opening);

    if (opening && this._width$.getValue() < this.MIN_OPEN_WIDTH) {
      this._width$.next(this.DEFAULT_OPEN_WIDTH);
    }
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
      // `open`, so no component adopts open-state styling prematurely.
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
        this.userCollapsePreference.set("open");
        this.open.set(true);
        this._width$.next(this.DEFAULT_OPEN_WIDTH);
      }
      return;
    }

    const currentWidth = this._width$.getValue();

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
   * Called when a drag ends. Releasing in the collapsed preview zone commits to open at the default
   * width; releasing in the tension zone springs back to the minimum. A drag that ended collapsed
   * leaves the persisted width alone, so a customized width survives a collapse.
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
      this._width$.next(this.MIN_OPEN_WIDTH);
      return;
    }

    // Released in the collapsed preview zone — commit to open at the default width.
    this.userCollapsePreference.set("open");
    this.open.set(true);
    this._width$.next(this.DEFAULT_OPEN_WIDTH);
  }

  /** Set the width, clamped to the min/max bounds. */
  private _setWidthWithinMinMax(newWidth: number) {
    // Never widen past what the container can push, or main content would be clipped.
    const max = Math.max(
      this.MIN_OPEN_WIDTH,
      Math.min(this.MAX_OPEN_WIDTH, this.maxPushWidthRem()),
    );
    const width = Math.min(Math.max(newWidth, this.MIN_OPEN_WIDTH), max);

    this._width$.next(width);
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
