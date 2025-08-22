import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  CipherBulkArchiveRequest,
  CipherBulkUnarchiveRequest,
} from "@bitwarden/common/vault/models/request/cipher-bulk-archive.request";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";

import { CipherArchiveService } from "../abstractions/cipher-archive.service";
import { DecryptionFailureDialogComponent } from "../components/decryption-failure-dialog/decryption-failure-dialog.component";

import { PasswordRepromptService } from "./password-reprompt.service";

export class DefaultCipherArchiveService implements CipherArchiveService {
  constructor(
    private cipherService: CipherService,
    private apiService: ApiService,
    private dialogService: DialogService,
    private passwordRepromptService: PasswordRepromptService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private configService: ConfigService,
  ) {}

  // Check if the user has premium from any source (personal or organization)
  // Check if feature flag is enabled
  // If the user is NOT a premium user, but there are items with an archiveDate return true.
  async userCanArchive(userId: UserId): Promise<boolean> {
    await firstValueFrom(this.billingAccountProfileStateService.hasPremiumFromAnySource$(userId));

    return await this.configService.getFeatureFlag(FeatureFlag.PM19148_InnovationArchive);
  }

  async archiveWithServer(ids: CipherId | CipherId[], userId: UserId): Promise<void> {
    const request = new CipherBulkArchiveRequest(Array.isArray(ids) ? ids : [ids]);
    const r = await this.apiService.send("PUT", "/ciphers/archive", request, true, true);
    const response = new ListResponse(r, CipherResponse);

    await this.cipherService.updateEncryptedCipherState((ciphers) => {
      for (const cipher of response.data) {
        const localCipher = ciphers[cipher.id as CipherId];

        if (localCipher == null) {
          continue;
        }

        localCipher.archivedDate = cipher.archivedDate;
        localCipher.revisionDate = cipher.revisionDate;
      }
      return ciphers;
    }, userId);
  }

  async unarchiveWithServer(ids: CipherId | CipherId[], userId: UserId): Promise<void> {
    const request = new CipherBulkUnarchiveRequest(Array.isArray(ids) ? ids : [ids]);
    const r = await this.apiService.send("PUT", "/ciphers/unarchive", request, true, true);
    const response = new ListResponse(r, CipherResponse);

    await this.cipherService.updateEncryptedCipherState((ciphers) => {
      for (const cipher of response.data) {
        const localCipher = ciphers[cipher.id as CipherId];

        if (localCipher == null) {
          continue;
        }

        localCipher.archivedDate = cipher.archivedDate;
        localCipher.revisionDate = cipher.revisionDate;
      }
      return ciphers;
    }, userId);
  }

  /**
   * Check if the user is able to interact with the cipher
   * (password re-prompt / decryption failure checks).
   * @param cipher
   * @param ignoreDecryptionFailure - If true, the decryption failure check will be ignored.
   * @private
   */
  async canInteract(cipher: CipherView, ignoreDecryptionFailure = false) {
    if (cipher.decryptionFailure) {
      DecryptionFailureDialogComponent.open(this.dialogService, {
        cipherIds: [cipher.id as CipherId],
      });
      return false;
    }

    return await this.passwordRepromptService.passwordRepromptCheck(cipher);
  }
}
