import { Observable } from "rxjs";

import { TotpResponse } from "@bitwarden/sdk-internal";

export abstract class TotpService {
  /**
   * Gets an observable that emits TOTP codes at regular intervals
   * @param key - Can be:
   *  - A base32 encoded string
   *  - OTP Auth URI
   *  - Steam URI
   * @returns Observable that emits TotpResponse containing the code and period
   */
  abstract getCode$(key: string): Observable<TotpResponse>;
}
