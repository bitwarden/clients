import { inject, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop";
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

const DEFAULT_OPEN_WIDTH = 288;
const MIN_OPEN_WIDTH = 240;
const MAX_OPEN_WIDTH = 384;
const BIT_SIDE_NAV_WIDTH_KEY_DEF = new KeyDefinition<number>(BIT_SIDE_NAV_DISK, "side-nav-width", {
  deserializer: (s) => s,
});

@Injectable({
  providedIn: "root",
})
export class SideNavService {
  private _open$ = new BehaviorSubject<boolean>(isAtOrLargerThanBreakpoint("md"));
  open$ = this._open$.asObservable();

  private isLargeScreen$ = media(`(min-width: ${BREAKPOINTS.md}px)`);
  private _userCollapsePreference$ = new BehaviorSubject<CollapsePreference>(null);
  userCollapsePreference$ = this._userCollapsePreference$.asObservable();

  isOverlay$ = combineLatest([this.open$, this.isLargeScreen$]).pipe(
    map(([open, isLargeScreen]) => open && !isLargeScreen),
  );

  protected lastOpenWidth = DEFAULT_OPEN_WIDTH;
  private readonly width = signal<number>(DEFAULT_OPEN_WIDTH);
  readonly width$ = toObservable(this.width);

  private readonly widthState = inject(GlobalStateProvider).get(BIT_SIDE_NAV_WIDTH_KEY_DEF);
  readonly widthState$ = this.widthState.state$.pipe(map((width) => width ?? DEFAULT_OPEN_WIDTH));

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
    this.widthState$.pipe(first(), takeUntilDestroyed()).subscribe((width: number) => {
      this.width.set(width);
    });

    // Handle width resize events
    this.width$.pipe(debounceTime(200), takeUntilDestroyed()).subscribe((width) => {
      // Store the last open width when the side nav is open
      if (this.open) {
        this.lastOpenWidth = width;
      }

      // Update the stored width state
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
   * Calculate and set new side nav width from drag event coordinates
   *
   * @param eventXCoordinate x coordinate of the pointer's bounding client rect
   * @param dragElementXCoordinate x coordinate of the drag element's bounding client rect
   */
  setWidthFromDrag(eventXPointer: number, dragElementXCoordinate: number) {
    const width = Math.min(
      Math.max(eventXPointer - dragElementXCoordinate, MIN_OPEN_WIDTH),
      MAX_OPEN_WIDTH,
    );

    this.width.set(width);
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
