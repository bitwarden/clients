import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

import { LeaseClock } from "@bitwarden/bit-pam";
import { AccessBadgeTickerService } from "@bitwarden/bit-pam-components";

/**
 * The shared lease clock for the desktop app. Every tick, and `now()`, reads a `LeaseClock`, so a
 * wall-clock rollback cannot stretch a countdown or a revealed lease, and a sleep or a forward
 * step still counts. Provided as `AccessBadgeTickerService` too, so badges, tabs and the revealed
 * view all read the one clock.
 */
@Injectable()
export class DesktopAccessBadgeTickerService extends AccessBadgeTickerService {
  private readonly clock = new LeaseClock();

  /** Emits when the wall clock was found to have jumped, or the system to have slept. */
  readonly clockJumps$: Observable<void> = this.clock.jumps$;

  override now(): number {
    return this.clock.now();
  }
}
