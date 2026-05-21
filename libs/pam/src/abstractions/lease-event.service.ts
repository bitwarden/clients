import { Observable } from "rxjs";

import { LeaseEvent } from "./lease-event";

/**
 * Streams credential-leasing lifecycle push events to consumers (cipher view,
 * "My requests" page, etc.).
 *
 * Implementations are expected to:
 *
 * - Subscribe once to the underlying server push channel and multiplex per
 *   request id (multiple components watching the same id share one upstream
 *   subscription — no duplicate fetches).
 * - Inherit reconnect / replay behavior from the underlying push transport;
 *   this abstraction does not buffer past events.
 *
 * Feature-flag gating is the consumer's responsibility — this stream is a
 * no-op (cold) until subscribed.
 */
export abstract class LeaseEventService {
  /**
   * Observable of {@link LeaseEvent}s for the given lease-request id.
   *
   * The observable does not complete; consumers should manage their own
   * teardown (e.g. `takeUntilDestroyed()` in Angular).
   */
  abstract events$(requestId: string): Observable<LeaseEvent>;
}
