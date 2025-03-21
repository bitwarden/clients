import { Injectable, WritableSignal } from "@angular/core";
import { Observable, of, switchMap, from } from "rxjs";

import { ViewCacheService } from "@bitwarden/angular/platform/abstractions/view-cache.service";
import { TwoFactorFormCacheService, TwoFactorFormData } from "@bitwarden/auth/angular";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

const TWO_FACTOR_FORM_CACHE_KEY = "two-factor-form-cache";

// Utilize function overloading to create a type-safe deserializer to match the exact expected signature
function deserializeFormData(jsonValue: null): null;
function deserializeFormData(jsonValue: {
  token?: string;
  remember?: boolean;
  selectedProviderType?: TwoFactorProviderType;
  emailSent?: boolean;
}): TwoFactorFormData;
function deserializeFormData(jsonValue: any): TwoFactorFormData | null {
  if (!jsonValue) {
    return null;
  }

  return {
    token: jsonValue.token,
    remember: jsonValue.remember,
    selectedProviderType: jsonValue.selectedProviderType,
    emailSent: jsonValue.emailSent,
  };
}

/**
 * Service for caching two-factor form data
 */
@Injectable()
export class ExtensionTwoFactorFormCacheService extends TwoFactorFormCacheService {
  private formDataCache: WritableSignal<TwoFactorFormData | null>;

  constructor(
    private viewCacheService: ViewCacheService,
    private configService: ConfigService,
  ) {
    super();
    this.formDataCache = this.viewCacheService.signal<TwoFactorFormData | null>({
      key: TWO_FACTOR_FORM_CACHE_KEY,
      initialValue: null,
      deserializer: deserializeFormData,
    });
  }

  /**
   * Observable that emits the current enabled state
   */
  isEnabled$(): Observable<boolean> {
    return from(this.configService.getFeatureFlag(FeatureFlag.PM9115_TwoFactorFormPersistence));
  }

  /**
   * Observable that emits the current form data
   */
  formData$(): Observable<TwoFactorFormData | null> {
    return this.isEnabled$().pipe(
      switchMap((enabled) => {
        if (!enabled) {
          return of(null);
        }
        return of(this.formDataCache());
      }),
    );
  }

  /**
   * Save form data to cache
   */
  async saveFormData(data: TwoFactorFormData): Promise<void> {
    if (!(await this.isEnabled())) {
      return;
    }

    // Set the new form data in the cache
    this.formDataCache.set({ ...data });
  }

  /**
   * Clear form data from cache
   */
  async clearFormData(): Promise<void> {
    this.formDataCache.set(null);
  }
}
