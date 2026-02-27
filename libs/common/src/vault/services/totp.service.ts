import { Observable, map, shareReplay, switchMap, timer } from "rxjs";

import { TotpResponse } from "@bitwarden/sdk-internal";

import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { TotpService as TotpServiceAbstraction } from "../abstractions/totp.service";

/**
 * Represents TOTP information including display formatting and timing
 */
export type TotpInfo = {
  /** The TOTP code value */
  totpCode: string;

  /** The TOTP code value formatted for display, includes spaces */
  totpCodeFormatted: string;

  /** Progress bar percentage value */
  totpDash: number;

  /** Seconds remaining until the TOTP code changes */
  totpSec: number;

  /** Indicates when the code is close to expiring */
  totpLow: boolean;
};

export class TotpService implements TotpServiceAbstraction {
  constructor(private sdkService: SdkService) {}

  getCode$(key: string): Observable<TotpResponse> {
    return timer(0, 1000).pipe(
      switchMap(() =>
        this.sdkService.client$.pipe(
          map((sdk) => {
            return sdk.vault().totp().generate_totp(key);
          }),
        ),
      ),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }
}
