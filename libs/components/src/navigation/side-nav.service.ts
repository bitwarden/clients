import { Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject, Observable, combineLatest, fromEvent, map, startWith } from "rxjs";

import { BREAKPOINTS, isAtOrLargerThanBreakpoint } from "../utils/responsive-utils";

type CollapsePreference = "open" | "closed" | null;

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

  constructor() {
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
}

export const media = (query: string): Observable<boolean> => {
  const mediaQuery = window.matchMedia(query);
  return fromEvent<MediaQueryList>(mediaQuery, "change").pipe(
    startWith(mediaQuery),
    map((list: MediaQueryList) => list.matches),
  );
};
