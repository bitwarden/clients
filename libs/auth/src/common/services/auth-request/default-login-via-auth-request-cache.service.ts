import { inject, Injectable, WritableSignal } from "@angular/core";

import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { LoginViaAuthRequestView } from "@bitwarden/common/auth/models/view/login-via-auth-request.view";
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

  private readonly defaultLoginViaAuthRequestCache: WritableSignal<LoginViaAuthRequestView | null> =
    this.viewCacheService.signal<LoginViaAuthRequestView | null>({
      key: LOGIN_VIA_AUTH_CACHE_KEY,
      initialValue: null,
      deserializer: LoginViaAuthRequestView.fromJSON,
    });

  constructor() {}

  /**
   * Update the cache with the new LoginView.
   */
  cacheLoginView(id: string, privateKey: Uint8Array, accessCode: string): void {
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
    this.defaultLoginViaAuthRequestCache.set(null);
  }

  /**
   * Returns the cached LoginViaAuthRequestView when available.
   */
  getCachedLoginViaAuthRequestView(): LoginViaAuthRequestView | null {
    return this.defaultLoginViaAuthRequestCache();
  }
}
