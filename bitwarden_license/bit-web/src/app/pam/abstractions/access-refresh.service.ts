import type { Observable } from "rxjs";

/**
 * Fan-out for "this cipher's access state may have changed, re-read it".
 *
 * The SDK's `cipher_access_state()` is a one-shot read, so surfaces that must react — the
 * cipher-view banner and the gated-cipher reloader, side by side in an open item — share this
 * signal instead of each polling. Every mutation calls {@link notifyAccessChanged}; every reader
 * subscribes to {@link accessChanged$} and re-reads.
 *
 * Carries no payload beyond the cipher id, since a re-read is cheap and authoritative; also the
 * single place a server-pushed access event merges in, driving both paths through the same code.
 */
export abstract class AccessRefreshService {
  /**
   * Emits whenever `cipherId`'s access state may have changed, from a mutation or a full
   * invalidation (see {@link notifyAccessChanged}). Never completes; consumers own their teardown.
   */
  abstract accessChanged$(cipherId: string): Observable<void>;

  /**
   * Announce that access changed. Pass a `cipherId` to invalidate one item, or omit it to
   * invalidate every subscriber — the shape a server push takes, since it says only "your access
   * changed", not for which item.
   */
  abstract notifyAccessChanged(cipherId?: string): void;
}
