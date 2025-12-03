import { inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  BehaviorSubject,
  Observable,
  combineLatest,
  fromEvent,
  map,
  startWith,
  debounceTime,
  first,
} from "rxjs";

import { BIT_SIDE_NAV_DISK, GlobalStateProvider, KeyDefinition } from "@bitwarden/state";

import { BREAKPOINTS, isAtOrLargerThanBreakpoint } from "../utils/responsive-utils";

type CollapsePreference = "open" | "closed" | null;

const BIT_SIDE_NAV_WIDTH_KEY_DEF = new KeyDefinition<number>(BIT_SIDE_NAV_DISK, "side-nav-width", {
  deserializer: (s) => s,
});

@Injectable({
  providedIn: "root",
})
export class SideNavService {
  readonly DEFAULT_OPEN_WIDTH = 288;
  readonly MIN_OPEN_WIDTH = 240;
  readonly MAX_OPEN_WIDTH = 384;

  private _open$ = new BehaviorSubject<boolean>(isAtOrLargerThanBreakpoint("md"));
  open$ = this._open$.asObservable();

  private isLargeScreen$ = media(`(min-width: ${BREAKPOINTS.md}px)`);
  private _userCollapsePreference$ = new BehaviorSubject<CollapsePreference>(null);
  userCollapsePreference$ = this._userCollapsePreference$.asObservable();

  isOverlay$ = combineLatest([this.open$, this.isLargeScreen$]).pipe(
    map(([open, isLargeScreen]) => open && !isLargeScreen),
  );

  private readonly _width$ = new BehaviorSubject<number>(this.DEFAULT_OPEN_WIDTH);
  readonly width$ = this._width$.asObservable();

  private readonly widthState = inject(GlobalStateProvider).get(BIT_SIDE_NAV_WIDTH_KEY_DEF);
  readonly widthState$ = this.widthState.state$.pipe(
    map((width) => width ?? this.DEFAULT_OPEN_WIDTH),
  );

  constructor() {
    // Handle open/close state
    combineLatest([this.isLargeScreen$, this.userCollapsePreference$])
      .pipe(takeUntilDestroyed())
      .subscribe(([isLargeScreen, userCollapsePreference]) => {
        if (!isLargeScreen) {
          this.setClose();
        } else if (userCollapsePreference !== "closed") {
          // Auto-open when user hasn't set preference (null) or prefers open
          this.setOpen();
        }
      });

    // Initialize the resizable width from state provider
    this.widthState$.pipe(first()).subscribe((width: number) => {
      this._width$.next(width);
    });

    // Handle width resize events
    this.width$.pipe(debounceTime(200), takeUntilDestroyed()).subscribe((width) => {
      void this.widthState.update(() => width);
    });
  }

  get open() {
    return this._open$.getValue();
  }

  setOpen() {
    this._open$.next(true);
  }

  setClose() {
    this._open$.next(false);
  }

  /**
   * Toggle the open/close state of the side nav
   */
  toggle() {
    const curr = this._open$.getValue();
    // Store user's preference based on what state they're toggling TO
    this._userCollapsePreference$.next(curr ? "closed" : "open");

    if (curr) {
      this.setClose();
    } else {
      this.setOpen();
    }
  }

  /**
   * Set new side nav width from drag event coordinates
   *
   * @param eventXCoordinate x coordinate of the pointer's bounding client rect
   * @param dragElementXCoordinate x coordinate of the drag element's bounding client rect
   */
  setWidthFromDrag(eventXPointer: number, dragElementXCoordinate: number) {
    const newWidth = eventXPointer - dragElementXCoordinate;

    this._setWidthWithinMinMax(newWidth);
  }

  /**
   * Set new side nav width from arrow key events
   *
   * @param key event key, must be either ArrowRight or ArrowLeft
   */
  setWidthFromKeys(key: "ArrowRight" | "ArrowLeft") {
    const currentWidth = this._width$.getValue();

    if (key === "ArrowLeft") {
      const newWidth = currentWidth - 10;
      this._setWidthWithinMinMax(newWidth);
    }

    if (key === "ArrowRight") {
      const newWidth = currentWidth + 10;
      this._setWidthWithinMinMax(newWidth);
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
