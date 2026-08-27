// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject, Injectable } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherId, UserId, OrganizationId } from "@bitwarden/common/types/guid";
import {
  CipherService,
  RestrictedCipherWriteError,
} from "@bitwarden/common/vault/abstractions/cipher.service";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { SecurityTaskType, TaskService } from "@bitwarden/common/vault/tasks";

import { CipherFormConfig } from "../abstractions/cipher-form-config.service";
import { CipherFormService } from "../abstractions/cipher-form.service";

function isSetEqual(a: Set<string>, b: Set<string>) {
  return a.size === b.size && [...a].every((value) => b.has(value));
}

@Injectable()
export class DefaultCipherFormService implements CipherFormService {
  private cipherService: CipherService = inject(CipherService);
  private accountService: AccountService = inject(AccountService);
  private taskService: TaskService = inject(TaskService);
  private revealedCipherService: RevealedCipherService = inject(RevealedCipherService);

  /** A restricted cipher resolves to a copy of its revealed view, since the form mutates it. */
  async decryptCipher(cipher: Cipher): Promise<CipherView> {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    if (cipher.isPartial) {
      const revealed = await this.revealedCipherService.getOrReveal(
        activeUserId,
        cipher.id as CipherId,
      );
      if (revealed != null) {
        return CipherView.fromSdkCipherView(revealed.toSdkCipherView());
      }
    }
    return await this.cipherService.decrypt(cipher, activeUserId);
  }

  async saveCipher(cipher: CipherView, config: CipherFormConfig): Promise<CipherView> {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    let savedCipher: Cipher;

    // Creating a new cipher
    if (cipher.id == null || cipher.id === "") {
      return await this.cipherService.createWithServer(cipher, activeUserId, config.admin);
    }

    if (config.originalCipher == null) {
      throw new Error("Original cipher is required for updating an existing cipher");
    }
    // For a restricted cipher this is a copy of the revealed view, the original its edit needs.
    const originalCipherView = await this.decryptCipher(config.originalCipher);

    // Updating an existing cipher

    const originalCollectionIds = new Set(config.originalCipher.collectionIds ?? []);
    const newCollectionIds = new Set(cipher.collectionIds ?? []);

    // Call shareWithServer if the owner is changing from a user to an organization
    if (config.originalCipher.organizationId == null && cipher.organizationId != null) {
      // shareWithServer expects the cipher to have no organizationId set
      const organizationId = cipher.organizationId as OrganizationId;
      cipher.organizationId = null;

      savedCipher = await this.cipherService.shareWithServer(
        cipher,
        organizationId,
        cipher.collectionIds,
        activeUserId,
        originalCipherView,
      );
      // If the collectionIds are the same, update the cipher normally
    } else if (isSetEqual(originalCollectionIds, newCollectionIds)) {
      // Returned as is: the result of a restricted cipher's save is restricted, and encrypting it
      // for a decrypt round trip would throw after the server accepted the write.
      const saved = await this.cipherService.updateWithServer(
        cipher,
        activeUserId,
        originalCipherView,
        config.admin,
        config.leaseGated,
      );
      await this.markAssociatedTaskAsComplete(activeUserId, cipher, config);
      return saved;
    } else {
      // The collection save would re-encrypt the restricted result of the first write, so refuse
      // before either write rather than half-apply the change.
      if (config.originalCipher.isPartial) {
        throw new RestrictedCipherWriteError();
      }

      // Updating a cipher with collection changes is not supported with a single request currently
      // Save the new collectionIds before overwriting
      const newCollectionIdsToSave = cipher.collectionIds;

      // First update the cipher with the original collectionIds
      cipher.collectionIds = config.originalCipher.collectionIds;
      const newCipher = await this.cipherService.updateWithServer(
        cipher,
        activeUserId,
        originalCipherView,
        config.admin || originalCollectionIds.size === 0,
        config.leaseGated,
      );

      // Then save the new collection changes separately
      newCipher.collectionIds = newCollectionIdsToSave;

      // TODO: Remove after migrating all SDK ops
      const { cipher: encryptedCipher } = await this.cipherService.encrypt(newCipher, activeUserId);
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

    await this.markAssociatedTaskAsComplete(activeUserId, cipher, config);

    // Its possible the cipher was made no longer available due to collection assignment changes
    // e.g. The cipher was moved to a collection that the user no longer has access to
    if (savedCipher == null) {
      return null;
    }

    return await this.cipherService.decrypt(savedCipher, activeUserId);
  }

  /**
   * When a cipher has an associated pending `UpdateAtRiskCredential` task
   * and the password has changed, mark the task as complete.
   */
  private async markAssociatedTaskAsComplete(
    userId: UserId,
    updatedCipher: CipherView,
    config: CipherFormConfig,
  ) {
    const decryptedOriginalCipherCipher = await this.decryptCipher(config.originalCipher);

    const associatedPendingTask = await firstValueFrom(
      this.taskService
        .pendingTasks$(userId)
        .pipe(
          map((tasks) =>
            tasks.find(
              (task) =>
                task.type === SecurityTaskType.UpdateAtRiskCredential &&
                task.cipherId === updatedCipher.id,
            ),
          ),
        ),
    );

    const passwordHasChanged =
      updatedCipher.type === CipherType.Login &&
      updatedCipher.login.password &&
      updatedCipher.login.password !== decryptedOriginalCipherCipher?.login?.password;

    // When there is not an associated pending task or the password has not changed,
    // no action needed-return early.
    if (!associatedPendingTask || !passwordHasChanged) {
      return;
    }

    // If the cipher is a login and the password has changed, mark the associated task as complete
    await this.taskService.markAsComplete(associatedPendingTask.id, userId);
  }
}
