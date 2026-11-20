import { Observable } from "rxjs";

/**
 * Count of PAM items awaiting the user's attention, for the nav badge. Implemented in commercial
 * code; unprovided builds fall back to `0`.
 */
export abstract class PamNavBadgeService {
  /** Multicast, so each extra subscriber adds no upstream work. */
  abstract readonly count$: Observable<number>;
}
