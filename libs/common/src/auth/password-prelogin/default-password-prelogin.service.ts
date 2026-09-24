import { Observable, catchError, firstValueFrom, from, shareReplay } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { fromSdkKdfConfig } from "@bitwarden/legacy-crypto";
import { PasswordPreloginResponse as SdkPasswordPreloginResponse } from "@bitwarden/sdk-internal";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import { ConfigService } from "../../platform/abstractions/config/config.service";
import { SdkService } from "../../platform/abstractions/sdk/sdk.service";

import { PasswordPreloginApiService } from "./password-prelogin-api.service";
import { PasswordPreloginData } from "./password-prelogin.model";
import { PasswordPreloginRequest } from "./password-prelogin.request";
import { PasswordPreloginResult } from "./password-prelogin.result";
import { PasswordPreloginService } from "./password-prelogin.service";

export class DefaultPasswordPreloginService implements PasswordPreloginService {
  private currentEmail: string | null = null;
  private currentPreloginResult$: Observable<PasswordPreloginResult> | null = null;

  constructor(
    private passwordPreloginApiService: PasswordPreloginApiService,
    private sdkService: SdkService,
    private configService: ConfigService,
  ) {}

  getPreloginData$(email: string): Observable<PasswordPreloginResult> {
    const normalized = email.trim().toLowerCase();

    if (normalized === this.currentEmail && this.currentPreloginResult$ !== null) {
      return this.currentPreloginResult$;
    }

    this.currentEmail = normalized;
    this.currentPreloginResult$ = from(this.fetchPreloginResult(normalized)).pipe(
      catchError((err: unknown) => {
        // If the fetch fails, we want to reset the stored email and prelogin data so that future calls will attempt to fetch again
        // otherwise, there isn't a way to recover from a failed call since the failed result would be cached indefinitely
        this.currentEmail = null;
        this.currentPreloginResult$ = null;
        throw err;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.currentPreloginResult$;
  }

  clearCache(): void {
    this.currentEmail = null;
    this.currentPreloginResult$ = null;
  }

  private async fetchPreloginResult(email: string): Promise<PasswordPreloginResult> {
    // TODO: PM-40137 - Remove this flag
    const useSdk = await this.configService.getFeatureFlag(
      FeatureFlag.PM27060_PasswordPreloginFromSdk,
    );

    const data = useSdk
      ? await this.fetchPreloginDataFromSdk(email)
      : await this.fetchPreloginDataFromApi(email);

    // Pairing the source with the data it produced is what keeps a single login on a single
    // decision; callers must not resolve the source again.
    return new PasswordPreloginResult(useSdk, data);
  }

  private async fetchPreloginDataFromApi(email: string): Promise<PasswordPreloginData> {
    const response = await this.passwordPreloginApiService.getPreloginData(
      new PasswordPreloginRequest(email),
    );
    return PasswordPreloginData.fromResponse(response);
  }

  private async fetchPreloginDataFromSdk(email: string): Promise<PasswordPreloginData> {
    const client = await firstValueFrom(this.sdkService.client$);
    const loginClient = client.auth().login();
    const sdkResponse: SdkPasswordPreloginResponse = await loginClient.get_password_prelogin(email);
    const kdfConfig = fromSdkKdfConfig(sdkResponse.kdf);
    kdfConfig.validateKdfConfigForPrelogin();
    return new PasswordPreloginData(kdfConfig, sdkResponse.salt);
  }
}
