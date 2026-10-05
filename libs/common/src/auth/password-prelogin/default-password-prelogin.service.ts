import { Observable, catchError, firstValueFrom, from, shareReplay } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { fromSdkKdfConfig } from "@bitwarden/legacy-crypto";
import { PasswordPreloginResponse as SdkPasswordPreloginResponse } from "@bitwarden/sdk-internal";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import { MasterPasswordSalt } from "../../key-management/master-password/types/master-password.types";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";

import { PasswordPreloginApiService } from "./password-prelogin-api.service";
import { PasswordPreloginData } from "./password-prelogin.model";
import { PasswordPreloginRequest } from "./password-prelogin.request";
import { PasswordPreloginService } from "./password-prelogin.service";

export class DefaultPasswordPreloginService implements PasswordPreloginService {
  private currentEmail: string | null = null;
  private currentPreloginData$: Observable<PasswordPreloginData> | null = null;

  constructor(
    private passwordPreloginApiService: PasswordPreloginApiService,
    private sdkService: SdkService,
    private configService: ConfigService,
  ) {}

  getPreloginData$(email: string): Observable<PasswordPreloginData> {
    const normalized = email.trim().toLowerCase();

    if (normalized === this.currentEmail && this.currentPreloginData$ !== null) {
      return this.currentPreloginData$;
    }

    this.currentEmail = normalized;
    this.currentPreloginData$ = from(this.fetchPreloginData(normalized)).pipe(
      catchError((err: unknown) => {
        // If the fetch fails, we want to reset the stored email and prelogin data so that future calls will attempt to fetch again
        // otherwise, there isn't a way to recover from a failed call since the failed result would be cached indefinitely
        this.currentEmail = null;
        this.currentPreloginData$ = null;
        throw err;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.currentPreloginData$;
  }

  clearCache(): void {
    this.currentEmail = null;
    this.currentPreloginData$ = null;
  }

  /**
   * Resolves both the KDF config and the salt to derive with. The flag is read once, here, so
   * that its outcome travels with the returned data. A second read downstream can observe a
   * different value (the pre-auth server config renews on an interval) and disagree with the
   * fetch that produced the data.
   */
  private async fetchPreloginData(email: string): Promise<PasswordPreloginData> {
    // TODO: PM-40137 - Remove this flag
    const useSdk = await this.configService.getFeatureFlag(
      FeatureFlag.PM27060_PasswordPreloginFromSdk,
    );

    // The flag picks the transport only. Both transports resolve the salt the same way:
    // the server's salt when it supplies one, the normalized email when it does not.
    return useSdk ? this.fetchPreloginDataFromSdk(email) : this.fetchPreloginDataFromApi(email);
  }

  private async fetchPreloginDataFromApi(email: string): Promise<PasswordPreloginData> {
    const response = await this.passwordPreloginApiService.getPreloginData(
      new PasswordPreloginRequest(email),
    );

    const kdfConfig = response.kdfSettings.toKdfConfig();
    // Pre-login downgrade guard. Validate the instance we return, not a throwaway copy.
    // The SDK path validates the same way.
    kdfConfig.validateKdfConfigForPrelogin();

    // The server's salt column is nullable and was never backfilled, so a null reaches us for
    // accounts that predate it. `email` is already normalized by getPreloginData$.
    return new PasswordPreloginData(kdfConfig, response.salt ?? (email as MasterPasswordSalt));
  }

  private async fetchPreloginDataFromSdk(email: string): Promise<PasswordPreloginData> {
    const client = await firstValueFrom(this.sdkService.client$);
    const loginClient = client.auth().login();
    const sdkResponse: SdkPasswordPreloginResponse = await loginClient.get_password_prelogin(email);
    const kdfConfig = fromSdkKdfConfig(sdkResponse.kdf);
    kdfConfig.validateKdfConfigForPrelogin();
    return new PasswordPreloginData(kdfConfig, sdkResponse.salt as MasterPasswordSalt);
  }
}
