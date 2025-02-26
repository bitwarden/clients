// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { CipherFormConfig } from "../abstractions/cipher-form-config.service";
import { CipherFormService } from "../abstractions/cipher-form.service";

function isSetEqual(a: Set<string>, b: Set<string>) {
  return a.size === b.size && [...a].every((value) => b.has(value));
}

@Injectable()
export class DefaultCipherFormService implements CipherFormService {
  private cipherService: CipherService = inject(CipherService);
  private accountService: AccountService = inject(AccountService);
  private apiService: ApiService = inject(ApiService);

  async decryptCipher(cipher: Cipher): Promise<CipherView> {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return await cipher.decrypt(
      await this.cipherService.getKeyForCipherKeyDecryption(cipher, activeUserId),
    );
  }

  async saveCipher(cipher: CipherView, config: CipherFormConfig): Promise<CipherView> {
    // Passing the original cipher is important here as it is responsible for appending to password history
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const encryptedCipher = await this.cipherService.encrypt(
      cipher,
      activeUserId,
      null,
      null,
      config.originalCipher ?? null,
    );

    let savedCipher: Cipher;

    // Creating a new cipher
    if (cipher.id == null) {
      savedCipher = await this.cipherService.createWithServer(encryptedCipher, config.admin);
      return await savedCipher.decrypt(
        await this.cipherService.getKeyForCipherKeyDecryption(savedCipher, activeUserId),
      );
    }

    if (config.originalCipher == null) {
      throw new Error("Original cipher is required for updating an existing cipher");
    }

    // Updating an existing cipher

    const originalCollectionIds = new Set(config.originalCipher.collectionIds ?? []);
    const newCollectionIds = new Set(cipher.collectionIds ?? []);

    // Call shareWithServer if the owner is changing from a user to an organization
    if (config.originalCipher.organizationId === null && cipher.organizationId != null) {
      savedCipher = await this.cipherService.shareWithServer(
        cipher,
        cipher.organizationId,
        cipher.collectionIds,
        activeUserId,
      );
      // If the collectionIds are the same, update the cipher normally
    } else if (isSetEqual(originalCollectionIds, newCollectionIds)) {
      savedCipher = await this.cipherService.updateWithServer(encryptedCipher, config.admin);
    } else {
      // Updating a cipher with collection changes is not supported with a single request currently
      // First update the cipher with the original collectionIds
      encryptedCipher.collectionIds = config.originalCipher.collectionIds;
      await this.cipherService.updateWithServer(
        encryptedCipher,
        config.admin || originalCollectionIds.size === 0,
      );

      // Then save the new collection changes separately
      encryptedCipher.collectionIds = cipher.collectionIds;

      if (config.admin || originalCollectionIds.size === 0) {
        // When using an admin config or the cipher was unassigned, update collections as an admin
        savedCipher = await this.cipherService.saveCollectionsWithServerAdmin(encryptedCipher);
      } else {
        savedCipher = await this.cipherService.saveCollectionsWithServer(
          encryptedCipher,
          activeUserId,
        );
      }
    }

    // Its possible the cipher was made no longer available due to collection assignment changes
    // e.g. The cipher was moved to a collection that the user no longer has access to
    if (savedCipher == null) {
      return null;
    }

    return await savedCipher.decrypt(
      await this.cipherService.getKeyForCipherKeyDecryption(savedCipher, activeUserId),
    );
  }
}
