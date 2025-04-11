import { inject, Injectable, WritableSignal } from "@angular/core";
import { Jsonify } from "type-fest";

import { ViewCacheService } from "@bitwarden/angular/platform/abstractions/view-cache.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

const TWO_FACTOR_AUTH_EMAIL_CACHE_KEY = "two-factor-auth-email-cache";

/**
 * Cache model for the email two factor
 */
export class TwoFactorAuthEmailCache {
  emailSent: boolean = false;

  static fromJSON(obj: Partial<Jsonify<TwoFactorAuthEmailCache>>): TwoFactorAuthEmailCache {
    return Object.assign(new TwoFactorAuthEmailCache(), obj);
  }
}

/**
 * Cache service for the two factor auth email component.
 */
@Injectable()
export class TwoFactorAuthEmailComponentCacheService {
  private viewCacheService: ViewCacheService = inject(ViewCacheService);
  private configService: ConfigService = inject(ConfigService);

  /** True when the feature flag is enabled */
  private featureEnabled: boolean = false;

  /**
   * Signal for the cached email state.
   */
  private emailCache: WritableSignal<TwoFactorAuthEmailCache | null> =
    this.viewCacheService.signal<TwoFactorAuthEmailCache | null>({
      key: TWO_FACTOR_AUTH_EMAIL_CACHE_KEY,
      initialValue: null,
      deserializer: TwoFactorAuthEmailCache.fromJSON,
    });

  /**
   * Must be called once before interacting with the cached data.
   */
  async init() {
    this.featureEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM9115_TwoFactorExtensionDataPersistence,
    );
  }

  /**
   * Cache the email sent state.
   */
  cacheData(data: { emailSent: boolean }): void {
    if (!this.featureEnabled) {
      return;
    }

    this.emailCache.set({
      emailSent: data.emailSent,
    } as TwoFactorAuthEmailCache);
  }

  /**
   * Clear the cached email data.
   */
  clearCachedData(): void {
    if (!this.featureEnabled) {
      return;
    }

    this.emailCache.set(null);
  }

  /**
   * Get whether the email has been sent.
   */
  getCachedData(): TwoFactorAuthEmailCache | null {
    if (!this.featureEnabled) {
      return null;
    }

    return this.emailCache();
  }
}
