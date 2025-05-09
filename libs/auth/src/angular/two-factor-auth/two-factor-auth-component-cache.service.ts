import { inject, Injectable, WritableSignal } from "@angular/core";
import { Jsonify } from "type-fest";

import { ViewCacheService } from "@bitwarden/angular/platform/abstractions/view-cache.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

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
  private configService: ConfigService = inject(ConfigService);

  /** True when the `PM9115_TwoFactorExtensionDataPersistence` flag is enabled */
  private featureEnabled: boolean = false;

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
   * Must be called once before interacting with the cached data.
   */
  async init() {
    this.featureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM9115_TwoFactorExtensionDataPersistence,
    );
  }

  /**
   * Update the cache with the new TwoFactorAuthData.
   */
  cacheData(data: TwoFactorAuthComponentData): void {
    if (!this.featureEnabled) {
      return;
    }

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
    if (!this.featureEnabled) {
      return;
    }

    this.twoFactorAuthComponentCache.set(null);
  }

  /**
   * Returns the cached TwoFactorAuthData (when available).
   */
  getCachedData(): TwoFactorAuthComponentCache | null {
    if (!this.featureEnabled) {
      return null;
    }

    return this.twoFactorAuthComponentCache();
  }
}
