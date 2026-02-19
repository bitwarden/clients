import { computed, inject, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { BehaviorSubject, Observable, fromEvent, map, startWith, debounceTime, first } from "rxjs";

import { BIT_SIDE_NAV_DISK, GlobalStateProvider, KeyDefinition } from "@bitwarden/state";

import { getRootFontSizePx } from "../shared";

const BIT_SIDE_NAV_WIDTH_KEY_DEF = new KeyDefinition<number>(BIT_SIDE_NAV_DISK, "side-nav-width", {
  deserializer: (s) => s,
});

@Injectable({
  providedIn: "root",
})
export class SideNavService {
  // Units in rem
  readonly DEFAULT_OPEN_WIDTH = 18;
  readonly MIN_OPEN_WIDTH = 15;
  readonly MAX_OPEN_WIDTH = 24;

  private rootFontSizePx: number;

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
    const newWidthInPixels = eventXPointer - dragElementXCoordinate;

    const newWidthInRem = newWidthInPixels / this.rootFontSizePx;

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
