import type { Observable } from "rxjs";

/**
 * Fan-out for "this cipher's access state may have changed, re-read it", since the SDK's
 * `cipher_access_state()` is a one-shot read. Server pushes merge in here too.
 */
export abstract class AccessRefreshService {
  /**
   * Emits when `cipherId`'s access may have changed, including on a full invalidation. Omit
   * `cipherId` to hear every change. No replay, never completes; consumers own their teardown.
   */
  abstract accessChanged$(cipherId?: string): Observable<void>;

  /** Invalidates one cipher's readers, or every subscriber when `cipherId` is omitted. */
  abstract notifyAccessChanged(cipherId?: string): void;
}
