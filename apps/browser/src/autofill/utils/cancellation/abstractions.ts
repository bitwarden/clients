import type { Observable } from "rxjs";

/**
 * Tells work whether it has been cancelled. The work reads the token at the moments it can stop,
 * and never learns what cancelled it. A source that cancels is made with `cancellationToken`, and
 * is the party that holds its means to cancel.
 *
 * A token holds no resources, so nothing disposes it.
 */
export abstract class CancellationToken {
  /**
   * Whether the token has been cancelled. Read it at the moments the work can stop, and read it
   * again after an `await`, because an earlier answer goes stale. A token that was cancelled stays
   * cancelled.
   */
  abstract readonly cancelled: boolean;

  /**
   * Emits, and ends, once the token is cancelled, including for a subscriber that arrives
   * afterwards. Compose it with `takeUntil` to end a wait at once. A token that is never cancelled
   * never emits and never ends.
   */
  abstract readonly cancelled$: Observable<void>;
}
