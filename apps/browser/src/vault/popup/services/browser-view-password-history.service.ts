// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject } from "@angular/core";
import { Router } from "@angular/router";

import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

/**
 * This class handles the premium upgrade process for the browser extension.
 */
export class BrowserViewPasswordHistoryService implements ViewPasswordHistoryService {
  private router = inject(Router);

  /**
   * Navigates to the password history screen.
   */
  async viewPasswordHistory(cipher: CipherView) {
    await this.router.navigate(["/cipher-password-history"], {
      queryParams: { cipherId: cipher.id },
    });
  }
}
