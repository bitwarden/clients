import { Observable } from "rxjs";

import { PasswordPreloginData } from "./password-prelogin.model";

export abstract class PasswordPreloginService {
  /**
   * Returns an observable that emits the prelogin data for the given email.
   *
   * Safe to call without subscribing (fire-and-forget) to start the request early,
   * then call again with the same email to await the result. Returns the same
   * in-flight observable for a given email, starting a fresh request if the email changes.
   */
  abstract getPreloginData$(email: string): Observable<PasswordPreloginData>;

  /**
   * Clears any cached prelogin data. Should be called after a successful password login
   * to prevent stale KDF config from persisting in memory.
   */
  abstract clearCache(): void;
}
