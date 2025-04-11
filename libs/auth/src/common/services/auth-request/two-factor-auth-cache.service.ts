import { inject, Injectable, WritableSignal } from "@angular/core";
import { Jsonify } from "type-fest";

import { ViewCacheService } from "@bitwarden/angular/platform/abstractions/view-cache.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

const TWO_FACTOR_AUTH_CACHE_KEY = "two-factor-auth-cache";

/**
 * This is a cache model for the two factor authentication data.
 */
export class TwoFactorAuthCache {
  token: string | undefined = undefined;
  remember: boolean | undefined = undefined;
  selectedProviderType: TwoFactorProviderType | undefined = undefined;

  static fromJSON(obj: Partial<Jsonify<TwoFactorAuthCache>>): TwoFactorAuthCache {
    return Object.assign(new TwoFactorAuthCache(), obj);
  }
}

export interface TwoFactorAuthData {
  token?: string;
  remember?: boolean;
  selectedProviderType?: TwoFactorProviderType;
}

/**
 * This is a cache service used for the two factor auth component.
 *
 * There is sensitive information stored temporarily here. Cache will be cleared
 * after 2 minutes.
 */
@Injectable()
export class TwoFactorAuthComponentCacheService {
  private viewCacheService: ViewCacheService = inject(ViewCacheService);
  private configService: ConfigService = inject(ConfigService);

  /** True when the `PM9115_TwoFactorExtensionDataPersistence` flag is enabled */
  private featureEnabled: boolean = false;

  /**
   * Signal for the cached TwoFactorAuthData.
   */
  private twoFactorAuthCache: WritableSignal<TwoFactorAuthCache | null> =
    this.viewCacheService.signal<TwoFactorAuthCache | null>({
      key: TWO_FACTOR_AUTH_CACHE_KEY,
      initialValue: null,
      deserializer: TwoFactorAuthCache.fromJSON,
    });

  constructor() {}

  /**
   * Must be called once before interacting with the cached data, otherwise methods will be noop.
   */
  async init() {
    this.featureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM9115_TwoFactorExtensionDataPersistence,
    );
  }

  /**
   * Update the cache with the new TwoFactorAuthData.
   */
  cacheData(data: TwoFactorAuthData): void {
    if (!this.featureEnabled) {
      return;
    }

    this.twoFactorAuthCache.set({
      token: data.token,
      remember: data.remember,
      selectedProviderType: data.selectedProviderType,
    } as TwoFactorAuthCache);
  }

  /**
   * Clears the cached TwoFactorAuthData.
   */
  clearCachedData(): void {
    if (!this.featureEnabled) {
      return;
    }

    this.twoFactorAuthCache.set(null);
  }

  /**
   * Returns the cached TwoFactorAuthData when available.
   */
  getCachedData(): TwoFactorAuthCache | null {
    if (!this.featureEnabled) {
      return null;
    }

    return this.twoFactorAuthCache();
  }
}
