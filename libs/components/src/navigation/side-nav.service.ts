import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, fromEvent, map, startWith } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class SideNavService {
  private _open$ = new BehaviorSubject<boolean>(!window.matchMedia("(max-width: 768px)").matches);
  open$ = this._open$.asObservable();

  isOverlay$ = combineLatest([this.open$, media("(max-width: 768px)")]).pipe(
    map(([open, isSmallScreen]) => open && isSmallScreen),
  );

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
