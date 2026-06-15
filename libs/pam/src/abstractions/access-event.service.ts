import { Observable } from "rxjs";

/**
 * Streams a "your access changed" signal to credential-leasing requesters: a
 * cold, fire-and-forget tick that fires whenever the server pushes a
 * {@link NotificationType.RefreshAccessRequest} for the active user. Consumers
 * (the cipher lease banner, "My requests" page, vault-row badges, the open
 * cipher dialog) react by re-fetching their own access state — the push
 * deliberately carries no vault data, only the signal to re-fetch.
 *
 * Implementations are expected to:
 *
 * - Subscribe once to the underlying server push channel and share the result,
 *   so multiple consumers do not multiply upstream work.
 * - Inherit reconnect / replay behavior from the underlying push transport;
 *   this abstraction does not buffer past events.
 *
 * Feature-flag gating is the consumer's responsibility — this stream is a
 * no-op (cold) until subscribed.
 */
export abstract class AccessEventService {
  /**
   * Emits once per relevant server push. Carries no payload: the requester's
   * requests and leases changed for a reason other than this client's own
   * action, so the consumer should re-fetch. The observable does not complete;
   * consumers manage their own teardown (e.g. `takeUntilDestroyed()`).
   */
  abstract accessChanged$(): Observable<void>;
}
