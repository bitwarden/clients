import { map, Observable, shareReplay, switchMap, timer } from "rxjs";

import { TotpResponse } from "@bitwarden/sdk-internal";

import { SdkService } from "../../platform/abstractions/sdk/sdk.service";
import { RemoteSdkService } from "../../platform/services/sdk/remote-sdk.service";
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
  constructor(
    private sdkService: SdkService,
    private remoteSdkService?: RemoteSdkService,
  ) {}

  getCode$(key: string): Observable<TotpResponse> {
    return timer(0, 1000).pipe(
      switchMap(() => {
        if (this.remoteSdkService) {
          // Using remote SDK service to generate TOTP
          return this.remoteSdkService.remoteClient$.pipe(
            switchMap(async (sdk) => {
              using ref = await sdk!.take();
              const totp = await ref.value.vault().await.totp();
              // Force by-value transfer for the TOTP response
              return totp.generate_totp(key).await.by_value();
            }),
            shareReplay({ bufferSize: 1, refCount: true }),
          );
        } else {
          return this.sdkService.client$.pipe(
            map((sdk) => {
              return sdk.vault().totp().generate_totp(key);
            }),
            shareReplay({ bufferSize: 1, refCount: true }),
          );
        }
      }),
    );
  }
}
