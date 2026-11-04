import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

/**
 * Loads the Admin Console vault's ciphers as lightweight list views, and fully decrypts a cipher
 * only when it is actually needed (e.g. copying its password or assigning it to collections).
 *
 * Ciphers listed in the Admin Console are fetched from the organization endpoints and are not
 * necessarily in the user's local vault state, so the encrypted ciphers from the latest load are
 * kept here for on-demand decryption.
 */
@Injectable()
export class VaultCipherListService {
  private readonly cipherService = inject(CipherService);
  private readonly accountService = inject(AccountService);

  private encryptedCiphers = new Map<string, Cipher>();
  private latestLoadId = 0;

  /**
   * Fetches the organization's ciphers the current user can manage and returns them as list views.
   */
  async load(organization: Organization): Promise<CipherViewLike[]> {
    const loadId = ++this.latestLoadId;

    // Restricted providers (who are not members) do not have access to the org cipher endpoints.
    // Return early to avoid a 404 response.
    if (!organization.isMember && organization.isProviderUser) {
      this.encryptedCiphers = new Map();
      return [];
    }

    // If the user can edit all ciphers for the organization then fetch them ALL. Otherwise, only
    // fetch ciphers they have access to (includes unassigned for admins).
    const { ciphers, views } = organization.canEditAllCiphers
      ? await this.cipherService.getAllListViewsFromApiForOrganization(organization.id)
      : await this.cipherService.getManyListViewsFromApiForOrganization(organization.id);

    if (organization.canEditAllCiphers) {
      views.forEach((v) => {
        v.edit = true;
        v.viewPassword = true;
      });
    }

    // A newer load (e.g. after an org switch) may have finished first; don't overwrite its ciphers
    if (loadId === this.latestLoadId) {
      this.encryptedCiphers = new Map(ciphers.map((c) => [c.id, c]));
    }

    return views;
  }

  /**
   * Returns the full {@link CipherView} for a cipher from the latest load, decrypting it if needed.
   */
  async getFullCipherView(cipher: CipherViewLike): Promise<CipherView> {
    if (!CipherViewLikeUtils.isCipherListView(cipher)) {
      return cipher;
    }

    const encrypted = this.encryptedCiphers.get(uuidAsString(cipher.id!));
    if (encrypted == null) {
      throw new Error("Cipher was not found in the loaded organization ciphers");
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const cipherView = await this.cipherService.decrypt(encrypted, userId);
    // Keep the permissions applied to the list view at load time (e.g. admin overrides)
    cipherView.edit = cipher.edit;
    cipherView.viewPassword = cipher.viewPassword;
    return cipherView;
  }

  /**
   * Returns the full {@link CipherView}s for ciphers from the latest load, decrypting them if needed.
   */
  async getFullCipherViews(ciphers: CipherViewLike[]): Promise<CipherView[]> {
    return await Promise.all(ciphers.map((c) => this.getFullCipherView(c)));
  }
}
