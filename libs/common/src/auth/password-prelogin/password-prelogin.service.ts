import { Observable } from "rxjs";

import { PasswordPreloginResult } from "./password-prelogin.result";

export abstract class PasswordPreloginService {
  /**
   * Returns an observable that emits the prelogin data for the given email, paired with
   * the source it came from.
   *
   * Safe to call without subscribing (fire-and-forget) to start the request early,
   * then call again with the same email to await the result. Returns the same
   * in-flight observable for a given email, starting a fresh request if the email changes.
   *
   * Callers deriving a master key must honor the source on the emitted result rather than
   * resolving it themselves, so that one login uses one decision throughout.
   */
  abstract getPreloginData$(email: string): Observable<PasswordPreloginResult>;

  /**
   * Clears any cached prelogin data. Should be called after a successful password login
   * to prevent stale KDF config from persisting in memory.
   */
  abstract clearCache(): void;
}
