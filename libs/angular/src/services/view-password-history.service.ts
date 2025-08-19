import { Injectable } from "@angular/core";

import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { openPasswordHistoryDialog } from "@bitwarden/vault";

/**
 * This service is used to display the password history dialog in the vault.
 */
@Injectable()
export class VaultViewPasswordHistoryService implements ViewPasswordHistoryService {
  constructor(private dialogService: DialogService) {}

  /**
   * Opens the password history dialog for the given cipher ID.
   * @param cipherId The ID of the cipher to view the password history for.
   */
  async viewPasswordHistory(cipher: CipherView) {
    openPasswordHistoryDialog(this.dialogService, { data: { cipher } });
  }
}
