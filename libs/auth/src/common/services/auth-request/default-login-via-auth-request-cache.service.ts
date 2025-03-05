import { inject, Injectable, WritableSignal } from "@angular/core";

import { ViewCacheService } from "@bitwarden/angular/platform/abstractions/view-cache.service";
import { AuthRequest } from "@bitwarden/common/auth/models/request/auth.request";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { LoginViaAuthRequestView } from "@bitwarden/common/auth/models/view/login-via-auth-request.view";
import { Utils } from "@bitwarden/common/platform/misc/utils";

const LOGIN_VIA_AUTH_CACHE_KEY = "login-via-auth-request-form-cache";

@Injectable()
export class LoginViaAuthRequestCacheService {
  private viewCacheService: ViewCacheService = inject(ViewCacheService);

  /** True when the `PM9112_DeviceApproval` flag is enabled */
  private featureEnabled: boolean = false;

  private defaultLoginCache: WritableSignal<LoginViaAuthRequestView | null> =
    this.viewCacheService.signal<LoginViaAuthRequestView | null>({
      key: LOGIN_VIA_AUTH_CACHE_KEY,
      initialValue: null,
      deserializer: LoginViaAuthRequestView.fromJSON,
    });

  constructor() {}

  /**
   * Update the cache with the new LoginView.
   */
  cacheLoginView(
    authRequest: AuthRequest,
    authRequestResponse: AuthRequestResponse,
    fingerprintPhrase: string,
    keys: { privateKey: Uint8Array | undefined; publicKey: Uint8Array | undefined },
  ): void {
    if (!this.featureEnabled) {
      return;
    }

    this.defaultLoginCache.set({
      authRequest,
      authRequestResponse,
      fingerprintPhrase,
      privateKey: keys.privateKey ? Utils.fromBufferToB64(keys.privateKey.buffer) : undefined,
      publicKey: keys.publicKey ? Utils.fromBufferToB64(keys.publicKey.buffer) : undefined,
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
