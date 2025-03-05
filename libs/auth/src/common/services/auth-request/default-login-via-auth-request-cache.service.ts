import { inject, Injectable, WritableSignal } from "@angular/core";

import { ViewCacheService } from "@bitwarden/angular/platform/abstractions/view-cache.service";
import { AuthRequest } from "@bitwarden/common/auth/models/request/auth.request";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { LoginViaAuthRequestView } from "@bitwarden/common/auth/models/view/login-via-auth-request.view";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

const LOGIN_VIA_AUTH_CACHE_KEY = "login-via-auth-request-form-cache";

@Injectable()
export class LoginViaAuthRequestCacheService {
  private viewCacheService: ViewCacheService = inject(ViewCacheService);
  private configService: ConfigService = inject(ConfigService);

  /** True when the `PM9112_DeviceApproval` flag is enabled */
  private featureEnabled: boolean = false;

  /**
   * When true the `LoginViaAuthRequestCacheService` a cipher was stored in cache when the service
   * was initialized. Otherwise false, when the cache was empty.
   *
   * This is helpful to know the initial state of the cache as it can be populated quickly after initialization.
   */
  initializedWithValue: boolean;

  private defaultLoginCache: WritableSignal<LoginViaAuthRequestView | null> =
    this.viewCacheService.signal<LoginViaAuthRequestView | null>({
      key: LOGIN_VIA_AUTH_CACHE_KEY,
      initialValue: null,
      deserializer: LoginViaAuthRequestView.fromJSON,
    });

  constructor() {
    this.initializedWithValue = !!this.defaultLoginCache();
  }

  /**
   * Must be called once before interacting with the cached cipher, otherwise methods will be noop.
   */
  async init() {
    this.featureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM9112_DeviceApprovalPersistence,
    );

    if (!this.featureEnabled) {
      this.initializedWithValue = false;
    }
  }

  /**
   * Update the cache with the new LoginView.
   */
  cacheLoginView(
    authRequest: AuthRequest,
    authRequestResponse: AuthRequestResponse,
    fingerprintPhrase: string,
    keys: { privateKey: Uint8Array; publicKey: Uint8Array } | null = null,
  ): void {
    if (!this.featureEnabled) {
      return;
    }

    this.defaultLoginCache.set({
      authRequest,
      authRequestResponse,
      fingerprintPhrase,
      keys,
    } as LoginViaAuthRequestView);
  }

  /**
   * Returns the cached LoginViaAuthRequestView when available.
   */
  getCachedLoginViaAuthRequestView(): LoginViaAuthRequestView | null {
    if (!this.featureEnabled) {
      return null;
    }

    return this.defaultLoginCache();
  }
}
