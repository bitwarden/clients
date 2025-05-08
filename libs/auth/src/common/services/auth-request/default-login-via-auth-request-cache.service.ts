import { inject, Injectable, WritableSignal } from "@angular/core";

import { ViewCacheService } from "@bitwarden/angular/platform/abstractions/view-cache.service";
import { LoginViaAuthRequestView } from "@bitwarden/common/auth/models/view/login-via-auth-request.view";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

const LOGIN_VIA_AUTH_CACHE_KEY = "login-via-auth-request-form-cache";

/**
 * This is a cache service used for the login via auth request component.
 *
 * There is sensitive information stored temporarily here. Cache will be cleared
 * after 2 minutes.
 */
@Injectable()
export class LoginViaAuthRequestCacheService {
  private viewCacheService: ViewCacheService = inject(ViewCacheService);
  private configService: ConfigService = inject(ConfigService);

  /** True when the `PM9112_DeviceApproval` flag is enabled */
  private featureEnabled: boolean = false;

  private defaultLoginViaAuthRequestCache: WritableSignal<LoginViaAuthRequestView | null> =
    this.viewCacheService.signal<LoginViaAuthRequestView | null>({
      key: LOGIN_VIA_AUTH_CACHE_KEY,
      initialValue: null,
      deserializer: LoginViaAuthRequestView.fromJSON,
    });

  constructor() {}

  /**
   * Must be called once before interacting with the cached data, otherwise methods will be noop.
   */
  async init() {
    this.featureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM9112_DeviceApprovalPersistence,
    );
  }

  /**
   * Update the cache with the new LoginView.
   */
  cacheLoginView(id: string, privateKey: Uint8Array, accessCode: string): void {
    if (!this.featureEnabled) {
      return;
    }

    // When the keys get stored they should be converted to a B64 string to ensure
    // data can be properly formed when json-ified. If not done, they are not stored properly and
    // will not be parsable by the cryptography library after coming out of storage.
    this.defaultLoginViaAuthRequestCache.set({
      id: id,
      privateKey: Utils.fromBufferToB64(privateKey.buffer),
      accessCode: accessCode,
    } as LoginViaAuthRequestView);
  }

  clearCacheLoginView(): void {
    if (!this.featureEnabled) {
      return;
    }

    this.defaultLoginViaAuthRequestCache.set(null);
  }

  /**
   * Returns the cached LoginViaAuthRequestView when available.
   */
  getCachedLoginViaAuthRequestView(): LoginViaAuthRequestView | null {
    if (!this.featureEnabled) {
      return null;
    }

    return this.defaultLoginViaAuthRequestCache();
  }
}
