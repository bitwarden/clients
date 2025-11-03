import { Injectable, signal, computed } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { Observable, fromEvent, map, startWith } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class SideNavService {
  /**
   * Whether the side navigation is open or closed.
   */
  readonly open = signal<boolean>(!window.matchMedia("(max-width: 768px)").matches);

  private isSmallScreen$ = media("(max-width: 768px)");
  private readonly isSmallScreen = toSignal(this.isSmallScreen$, { requireSync: true });

  readonly isOverlay = computed(() => this.open() && this.isSmallScreen());

  constructor() {
    this.isSmallScreen$.pipe(takeUntilDestroyed()).subscribe((isSmallScreen) => {
      if (isSmallScreen) {
        this.open.set(false);
      }
    });
  }

  toggle() {
    this.open.update((curr) => !curr);
  }
}

export const media = (query: string): Observable<boolean> => {
  const mediaQuery = window.matchMedia(query);
  return fromEvent<MediaQueryList>(mediaQuery, "change").pipe(
    startWith(mediaQuery),
    map((list: MediaQueryList) => list.matches),
  );
};
