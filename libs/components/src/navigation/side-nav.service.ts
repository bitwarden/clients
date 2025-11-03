import { Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject, Observable, combineLatest, fromEvent, map, startWith } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class SideNavService {
  private _open$ = new BehaviorSubject<boolean>(!window.matchMedia("(max-width: 768px)").matches);
  open$ = this._open$.asObservable();

  private isSmallScreen$ = media("(max-width: 768px)");
  private _userToggledClosed$ = new BehaviorSubject<boolean>(false);
  userToggledClosed$ = this._userToggledClosed$.asObservable();

  isOverlay$ = combineLatest([this.open$, this.isSmallScreen$]).pipe(
    map(([open, isSmallScreen]) => open && isSmallScreen),
  );

  constructor() {
    combineLatest([this.isSmallScreen$, this.userToggledClosed$])
      .pipe(takeUntilDestroyed())
      .subscribe(([isSmallScreen, userToggledClosed]) => {
        if (isSmallScreen) {
          this.setClose();
        } else if (!userToggledClosed) {
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
    this._userToggledClosed$.next(curr);

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
