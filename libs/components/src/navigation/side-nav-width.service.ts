import { inject, Injectable, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Subject, debounceTime, first, map } from "rxjs";

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
 * The side nav width store: the current painted width, the width the user chose, the bounds both
 * are held within, and persistence.
 *
 * The width the user chose and the width currently painted are deliberately different things: a
 * drag preview, or a width narrowed to fit the container, must never become the user's preference.
 * Callers therefore have to pick a verb — `display` paints only, `commit` paints and remembers.
 * A commit also outranks a disk read that resolves after it. Nothing outside this class can reach
 * the stored value or the persisted one.
 *
 * This class knows nothing about gestures, open/closed state, or push/overlay mode — those belong
 * to `SideNavService`, which decides which verb to call.
 */
@Injectable({ providedIn: "root" })
export class SideNavWidthService {
  private readonly _widthState = inject(GlobalStateProvider).get(BIT_SIDE_NAV_WIDTH_KEY_DEF);

  private readonly _width = signal<number>(SIDE_NAV_WIDTH_BOUNDS.default);
  private readonly _hydrated = signal(false);
  private readonly _pendingCommit$ = new Subject<number>();

  private _savedWidth: number = SIDE_NAV_WIDTH_BOUNDS.default;

  /** Set once the user commits a width, so a late disk read cannot overwrite their choice. */
  private _userCommitted = false;

  /** The committed width to paint, in rem. */
  readonly width = this._width.asReadonly();

  /** True once the saved width has been read, so callers can gate first-paint behavior. */
  readonly hydrated = this._hydrated.asReadonly();

  constructor() {
    // Drags already persist only on release (SideNavService.onDragEnd). The debounce is for the
    // keyboard path: arrow-key autorepeat fires keydown ~30x/sec and every step is a commit.
    // It also coalesces the one-time out-of-bounds repair write below.
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
        this._hydrated.set(true);

        // A width the user committed while the read was in flight outranks the stored one, and
        // repairing a value they have already superseded would write a width nobody asked for.
        if (this._userCommitted) {
          return;
        }

        const repaired = this.clamp(diskWidth);

        this._savedWidth = repaired;
        this._width.set(repaired);

        if (repaired !== diskWidth) {
          this._pendingCommit$.next(repaired);
        }
      });
  }

  /** Paint `width` without changing what the user gets next time. */
  display(width: number) {
    this._width.set(width);
  }

  /** Paint `width` and remember it as the user's preference. */
  commit(width: number) {
    const clamped = this.clamp(width);
    const shouldPersist = clamped !== this._savedWidth;

    this._userCommitted = true;
    this._savedWidth = clamped;
    this._width.set(clamped);

    if (shouldPersist) {
      this._pendingCommit$.next(clamped);
    }
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
