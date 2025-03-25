import { inject } from "@angular/core";
import { Router } from "@angular/router";

import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

export class DesktopViewPasswordHistoryService implements ViewPasswordHistoryService {
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
