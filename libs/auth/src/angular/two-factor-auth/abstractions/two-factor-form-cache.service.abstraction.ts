import { Observable, firstValueFrom } from "rxjs";

import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";

/**
 * Interface for two-factor form data
 */
export interface TwoFactorFormData {
  token?: string;
  remember?: boolean;
  selectedProviderType?: TwoFactorProviderType;
  emailSent?: boolean;
}

/**
 * Abstract service for two-factor form caching
 */
export abstract class TwoFactorFormCacheService {
  /**
   * Observable that emits the current enabled state of the feature flag
   */
  abstract isEnabled$(): Observable<boolean>;

  /**
   * Helper method that returns whether the feature is enabled
   * @returns A promise that resolves to true if the feature is enabled
   */
  async isEnabled(): Promise<boolean> {
    return firstValueFrom(this.isEnabled$());
  }

  /**
   * Save form data to cache
   */
  abstract saveFormData(data: TwoFactorFormData): Promise<void>;

  /**
   * Observable that emits the current form data
   */
  abstract formData$(): Observable<TwoFactorFormData | null>;

  /**
   * Helper method to retrieve form data
   * @returns A promise that resolves to the form data
   */
  async getFormData(): Promise<TwoFactorFormData | null> {
    return firstValueFrom(this.formData$());
  }

  /**
   * Clear form data from cache
   */
  abstract clearFormData(): Promise<void>;
}
