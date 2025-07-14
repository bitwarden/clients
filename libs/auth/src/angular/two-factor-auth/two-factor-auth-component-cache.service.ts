import { inject, Injectable, WritableSignal } from "@angular/core";
import { Jsonify } from "type-fest";

import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";

const TWO_FACTOR_AUTH_COMPONENT_CACHE_KEY = "two-factor-auth-component-cache";

/**
 * Cache model for the two factor authentication data.
 */
export class TwoFactorAuthComponentCache {
  token: string | undefined = undefined;
  remember: boolean | undefined = undefined;
  selectedProviderType: TwoFactorProviderType | undefined = undefined;

  static fromJSON(
    obj: Partial<Jsonify<TwoFactorAuthComponentCache>>,
  ): TwoFactorAuthComponentCache | null {
    // Return null if the cache is empty
    if (obj == null) {
      return null;
    }

    return Object.assign(new TwoFactorAuthComponentCache(), obj);
  }
}

export interface TwoFactorAuthComponentData {
  token?: string;
  remember?: boolean;
  selectedProviderType?: TwoFactorProviderType;
}

/**
 * Cache service used for the two factor auth component.
 */
@Injectable()
export class TwoFactorAuthComponentCacheService {
  private viewCacheService: ViewCacheService = inject(ViewCacheService);

  /**
   * Signal for the cached TwoFactorAuthData.
   */
  private twoFactorAuthComponentCache: WritableSignal<TwoFactorAuthComponentCache | null> =
    this.viewCacheService.signal<TwoFactorAuthComponentCache | null>({
      key: TWO_FACTOR_AUTH_COMPONENT_CACHE_KEY,
      initialValue: null,
      deserializer: TwoFactorAuthComponentCache.fromJSON,
    });

  constructor() {}

  /**
   * Update the cache with the new TwoFactorAuthData.
   */
  cacheData(data: TwoFactorAuthComponentData): void {
    this.twoFactorAuthComponentCache.set({
      token: data.token,
      remember: data.remember,
      selectedProviderType: data.selectedProviderType,
    } as TwoFactorAuthComponentCache);
  }

  /**
   * Clears the cached TwoFactorAuthData.
   */
  clearCachedData(): void {
    this.twoFactorAuthComponentCache.set(null);
  }

  /**
   * Returns the cached TwoFactorAuthData (when available).
   */
  getCachedData(): TwoFactorAuthComponentCache | null {
    return this.twoFactorAuthComponentCache();
  }
}
