import { inject, Injectable, WritableSignal } from "@angular/core";
import { Jsonify } from "type-fest";

import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";

/**
 * The key for the email two factor auth component cache.
 */
export const TWO_FACTOR_AUTH_EMAIL_COMPONENT_CACHE_KEY = "two-factor-auth-email-component-cache";

/**
 * Cache model for the email two factor auth component.
 */
export class TwoFactorAuthEmailComponentCache {
  emailSent: boolean = false;

  static fromJSON(
    obj: Partial<Jsonify<TwoFactorAuthEmailComponentCache>>,
  ): TwoFactorAuthEmailComponentCache | null {
    // Return null if the cache is empty
    if (obj == null) {
      return null;
    }

    return Object.assign(new TwoFactorAuthEmailComponentCache(), obj);
  }
}

/**
 * Cache service for the two factor auth email component.
 */
@Injectable()
export class TwoFactorAuthEmailComponentCacheService {
  private viewCacheService: ViewCacheService = inject(ViewCacheService);

  /**
   * Signal for the cached email state.
   */
  private emailCache: WritableSignal<TwoFactorAuthEmailComponentCache | null> =
    this.viewCacheService.signal<TwoFactorAuthEmailComponentCache | null>({
      key: TWO_FACTOR_AUTH_EMAIL_COMPONENT_CACHE_KEY,
      initialValue: null,
      deserializer: TwoFactorAuthEmailComponentCache.fromJSON,
    });

  /**
   * Cache the email sent state.
   */
  cacheData(data: { emailSent: boolean }): void {
    this.emailCache.set({
      emailSent: data.emailSent,
    } as TwoFactorAuthEmailComponentCache);
  }

  /**
   * Clear the cached email data.
   */
  clearCachedData(): void {
    this.emailCache.set(null);
  }

  /**
   * Get whether the email has been sent.
   */
  getCachedData(): TwoFactorAuthEmailComponentCache | null {
    return this.emailCache();
  }
}
