import { inject, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject, Observable, Subject, debounceTime, first, map } from "rxjs";

import { BIT_SIDE_NAV_DISK, GlobalStateProvider, KeyDefinition } from "@bitwarden/state";

export const BIT_SIDE_NAV_WIDTH_KEY_DEF = new KeyDefinition<number>(
  BIT_SIDE_NAV_DISK,
  "side-nav-width",
  { deserializer: (s) => s },
);

/** Bounds the saved width is always held within, in rem. Excludes container-dependent limits. */
export const SIDE_NAV_WIDTH_BOUNDS = Object.freeze({
  min: 15, // 240px
  max: 37.5, // 600px
  default: 18.5, // 296px
});

/**
 * Owns the side nav width and its persistence.
 *
 * The width the user chose and the width currently painted are deliberately different things: a
 * drag preview, or a width narrowed to fit the container, must never become the user's preference.
 * Callers therefore have to pick a verb — `display` paints only, `commit` paints and remembers.
 * Nothing outside this class can reach the stored value or the persisted one.
 */
@Injectable({ providedIn: "root" })
export class SideNavWidthService {
  private readonly _widthState = inject(GlobalStateProvider).get(BIT_SIDE_NAV_WIDTH_KEY_DEF);

  private readonly _width$ = new BehaviorSubject<number>(SIDE_NAV_WIDTH_BOUNDS.default);
  private readonly _pendingCommit$ = new Subject<number>();

  private _savedWidth: number = SIDE_NAV_WIDTH_BOUNDS.default;

  /** The committed width to paint, in rem. */
  readonly width$: Observable<number> = this._width$.asObservable();

  /** True once the saved width has been read, so callers can gate first-paint behavior. */
  readonly hydrated = signal(false);

  constructor() {
    // Only explicit commits reach disk, debounced so a drag writes once rather than per frame.
    this._pendingCommit$.pipe(debounceTime(200), takeUntilDestroyed()).subscribe((width) => {
      void this._widthState.update(() => width);
    });

    // Read the saved width once and adopt it. A value outside the bounds is repaired and written
    // back, healing widths persisted by an older build exactly once.
    this._widthState.state$
      .pipe(
        map((width) => width ?? SIDE_NAV_WIDTH_BOUNDS.default),
        first(),
        takeUntilDestroyed(),
      )
      .subscribe((diskWidth) => {
        const repaired = this.clamp(diskWidth);

        this._savedWidth = repaired;
        this._width$.next(repaired);
        this.hydrated.set(true);

        if (repaired !== diskWidth) {
          this._pendingCommit$.next(repaired);
        }
      });
  }

  /** Paint `width` without changing what the user gets next time. */
  display(width: number) {
    this._width$.next(width);
  }

  /** Paint `width` and remember it as the user's preference. */
  commit(width: number) {
    const clamped = this.clamp(width);

    this._savedWidth = clamped;
    this._width$.next(clamped);
    this._pendingCommit$.next(clamped);
  }

  /** The width the user chose, always within bounds. Never narrowed to fit the container. */
  saved() {
    return this._savedWidth;
  }

  /** Hold `width` within the saved-width bounds. */
  clamp(width: number) {
    return Math.min(Math.max(width, SIDE_NAV_WIDTH_BOUNDS.min), SIDE_NAV_WIDTH_BOUNDS.max);
  }
}
