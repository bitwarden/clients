import { inject, Injectable } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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

  async decryptCipher(cipher: Cipher): Promise<CipherView> {
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    return await cipher.decrypt(
      await this.cipherService.getKeyForCipherKeyDecryption(cipher, activeUserId),
    );
  }

  async saveCipher(cipher: CipherView, config: CipherFormConfig): Promise<CipherView> {
    // Passing the original cipher is important here as it is responsible for appending to password history
    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
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

    // If the collectionIds are the same, update the cipher normally
    if (isSetEqual(originalCollectionIds, newCollectionIds)) {
      savedCipher = await this.cipherService.updateWithServer(encryptedCipher, config.admin);
    } else {
      // Updating a cipher with collection changes is not supported with a single request currently
      // First update collections. Collections need to be updated first to handle the case where a cipher is unassigned
      // and needs to be assigned to a collection before any other edits are made.
      if (config.admin || originalCollectionIds.size === 0) {
        // When using an admin config, update collections as an admin
        await this.cipherService.saveCollectionsWithServerAdmin(encryptedCipher);
      } else {
        await this.cipherService.saveCollectionsWithServer(encryptedCipher);
      }

      savedCipher = await this.cipherService.updateWithServer(encryptedCipher, config.admin);
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
