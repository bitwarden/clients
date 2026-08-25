import type { Observable } from "rxjs";

/**
 * Fan-out for "this cipher's access state may have changed, re-read it".
 *
 * The SDK's `cipher_access_state()` is a one-shot read, so surfaces that must react to access
 * changing — the cipher-view banner and the gated-cipher reloader, which sit side by side in an open
 * item — need a shared signal rather than each polling. Every mutation ends by calling
 * {@link notifyAccessChanged}; every reader subscribes to {@link accessChanged$} and re-reads.
 *
 * Carries no payload beyond the cipher id: a re-read is always cheap and always authoritative,
 * whereas shipping state through the signal would invite two surfaces to disagree. It is also the
 * single place a server-pushed access event will be merged in, so a push and a local mutation drive
 * the UI through exactly the same path.
 */
export abstract class AccessRefreshService {
  /**
   * Emits whenever `cipherId`'s access state may have changed — either because this client mutated
   * it or because every cipher was invalidated at once (see {@link notifyAccessChanged}). Never
   * completes; consumers own their teardown.
   *
   * Omit `cipherId` to hear every announcement whichever item it names: the reading a page-level
   * surface needs, since its state spans the caller's whole vault and any one of those mutations
   * can add, remove, or re-status a row on it.
   */
  abstract accessChanged$(cipherId?: string): Observable<void>;

  /**
   * Announce that access changed. Pass a `cipherId` to invalidate one item, or omit it to
   * invalidate every subscriber — the shape a server push takes, since it says only "your access
   * changed", not for which item.
   */
  abstract notifyAccessChanged(cipherId?: string): void;
}
