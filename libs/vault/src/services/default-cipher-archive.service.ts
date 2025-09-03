import {
  filter,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  switchMap,
  combineLatest,
} from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
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
    private accountService: AccountService,
  ) {}

  private userId$: Observable<UserId> = this.accountService.activeAccount$.pipe(
    map((a) => a?.id),
    filter((userId): userId is UserId => userId != null),
    shareReplay({ refCount: true, bufferSize: 1 }),
  );

  /**
   * Observable that contains the list of ciphers that have been archived.
   */
  archivedCiphers$: Observable<CipherViewLike[]> = this.userId$.pipe(
    switchMap((userId) =>
      this.cipherService.cipherListViews$(userId).pipe(
        filter((cipher) => cipher != null),
        map((ciphers) =>
          ciphers.filter(
            (cipher) =>
              CipherViewLikeUtils.isArchived(cipher) && !CipherViewLikeUtils.isDeleted(cipher),
          ),
        ),
      ),
    ),
  );

  /**
   * User can archive items if:
   * Feature Flag must be enabled
   * Check if user has premium from any source (personal or organization)
   */
  userCanArchive$(userId: UserId): Observable<boolean> {
    return combineLatest([
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(userId),
      this.configService.getFeatureFlag$(FeatureFlag.PM19148_InnovationArchive),
    ]).pipe(
      map(([hasPremium, archiveFlagEnabled]) => hasPremium && archiveFlagEnabled),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  /**
   * User can access the archive vault if:
   * Feature Flag is enabled
   * There is at least one archived item
   * ///////////// NOTE /////////////
   * This is separated from userCanArchive because a user that loses premium status, but has archived items,
   * should still be able to access their archive vault. The items will be read-only, and can be restored.
   */
  async showArchiveVault(userId: UserId): Promise<boolean> {
    const archiveFlagEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM19148_InnovationArchive,
    );
    const hasArchivedItems = await firstValueFrom(this.archivedCiphers$);

    return archiveFlagEnabled && hasArchivedItems.length > 0;
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
