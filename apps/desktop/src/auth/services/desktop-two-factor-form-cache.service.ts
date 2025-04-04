import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";

import { TwoFactorFormCacheService, TwoFactorFormData } from "@bitwarden/auth/angular";

/**
 * No-op implementation of TwoFactorFormCacheService for desktop
 */
@Injectable()
export class DesktopTwoFactorFormCacheService extends TwoFactorFormCacheService {
  constructor() {
    super();
  }

  isEnabled$(): Observable<boolean> {
    return of(false);
  }

  formData$(): Observable<TwoFactorFormData | null> {
    return of(null);
  }

  async saveFormData(): Promise<void> {
    return Promise.resolve();
  }

  async clearFormData(): Promise<void> {
    return Promise.resolve();
  }
}
