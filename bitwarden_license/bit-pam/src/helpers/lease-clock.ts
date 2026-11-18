import { Observable, Subject } from "rxjs";

/** The two clocks a `LeaseClock` reads, in ms. Replaceable so tests can move each on its own. */
export interface LeaseClockSource {
  /** The system (wall) clock, which the user or NTP can set, e.g. `Date.now()`. */
  wallMs(): number;
  /** A clock that never goes back, e.g. `performance.now()`. It may stop while the system sleeps. */
  monotonicMs(): number;
}

export const systemLeaseClockSource: LeaseClockSource = {
  wallMs: () => Date.now(),
  monotonicMs: () => performance.now(),
};

/**
 * How far the wall clock may drift from the monotonic one between two anchors before it counts as
 * a jump. Wide enough for NTP slewing and timer jitter; a rollback within it is not caught.
 */
export const LEASE_CLOCK_JUMP_TOLERANCE_MS = 2_000;

/**
 * The time to compare a lease's `notAfter` against: an epoch ms that a wall-clock rollback cannot
 * hold back. It follows the wall clock while the two clocks agree. When they disagree beyond the
 * tolerance (a manual change, an NTP step, or a sleep the monotonic clock did not count), it takes
 * the later of the wall clock and the monotonic time since the last anchor, re-anchors there, and
 * emits on `jumps$`. It never runs backwards.
 *
 * So a rollback keeps time running at the real rate, and a sleep or a forward step follows the wall
 * clock. What it cannot see is a rollback made during a sleep the monotonic clock did not count:
 * it then lags by up to the sleep's length, which is why a jump should be met by checking held
 * leases with the server. It also cannot see a wall clock that was already wrong before its first
 * reading, since it has no server time to compare against.
 *
 * Jumps are only seen when `now()` is called, so a caller holding a lease should read it on a timer.
 */
export class LeaseClock {
  private readonly jumpsSubject = new Subject<void>();

  /** Emits after a `now()` call that found the wall clock had jumped. */
  readonly jumps$: Observable<void> = this.jumpsSubject.asObservable();

  private anchorNow: number;
  private anchorWall: number;
  private anchorMonotonic: number;
  private lastNow: number;

  constructor(
    private readonly source: LeaseClockSource = systemLeaseClockSource,
    private readonly toleranceMs: number = LEASE_CLOCK_JUMP_TOLERANCE_MS,
  ) {
    this.anchorWall = this.anchorNow = this.lastNow = source.wallMs();
    this.anchorMonotonic = source.monotonicMs();
  }

  now(): number {
    const wall = this.source.wallMs();
    const monotonic = this.source.monotonicMs();
    const wallElapsed = wall - this.anchorWall;
    const monotonicElapsed = Math.max(0, monotonic - this.anchorMonotonic);
    const jumped = Math.abs(wallElapsed - monotonicElapsed) > this.toleranceMs;

    const now = Math.max(
      this.lastNow,
      jumped ? Math.max(wall, this.anchorNow + monotonicElapsed) : this.anchorNow + wallElapsed,
    );
    this.lastNow = now;
    if (jumped) {
      this.anchorNow = now;
      this.anchorWall = wall;
      this.anchorMonotonic = monotonic;
      this.jumpsSubject.next();
    }
    return now;
  }
}
