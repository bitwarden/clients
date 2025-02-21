import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { SharedModule } from "../../shared";
import { UserKeyRotationModule } from "../key-rotation/user-key-rotation.module";
import { UserKeyRotationService } from "../key-rotation/user-key-rotation.service";

// The master key was originally used to encrypt user data, before the user key was introduced.
// This component is used to migrate from the old encryption scheme to the new one.
@Component({
  standalone: true,
  imports: [SharedModule, UserKeyRotationModule],
  templateUrl: "migrate-legacy-encryption.component.html",
})
export class MigrateFromLegacyEncryptionComponent {
  protected formGroup = new FormGroup({
    masterPassword: new FormControl("", [Validators.required]),
  });

  constructor(
    private accountService: AccountService,
    private keyRotationService: UserKeyRotationService,
    private i18nService: I18nService,
    private keyService: KeyService,
    private messagingService: MessagingService,
    private logService: LogService,
    private syncService: SyncService,
    private toastService: ToastService,
    private dialogService: DialogService,
    private folderApiService: FolderApiServiceAbstraction,
  ) {}

  submit = async () => {
    this.formGroup.markAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    const activeUser = await firstValueFrom(this.accountService.activeAccount$);
    if (activeUser == null) {
      throw new Error("No active user.");
    }

    const hasUserKey = await this.keyService.hasUserKey(activeUser.id);
    if (hasUserKey) {
      this.messagingService.send("logout");
      throw new Error("User key already exists, cannot migrate legacy encryption.");
    }

    const masterPassword = this.formGroup.value.masterPassword!;

    try {
      await this.syncService.fullSync(false, true);

      await this.keyRotationService.rotateUserKeyAndEncryptedData(masterPassword, activeUser);

      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("keyUpdated"),
        message: this.i18nService.t("logBackInOthersToo"),
        timeout: 15000,
      });
      this.messagingService.send("logout");
    } catch (e) {
      // If the error is due to missing folders, we can delete all folders and try again
      if (
        e instanceof Error &&
        e.message === "All existing folders must be included in the rotation."
      ) {
        const deleteFolders = await this.dialogService.openSimpleDialog({
          type: "warning",
          title: { key: "encryptionKeyUpdateCannotProceed" },
          content: { key: "keyUpdateFoldersFailed" },
          acceptButtonText: { key: "ok" },
          cancelButtonText: { key: "cancel" },
        });

        if (deleteFolders) {
          await this.folderApiService.deleteAll(activeUser.id);
          await this.syncService.fullSync(true, true);
          await this.submit();
          return;
        }
      }
      this.logService.error(e);
      throw e;
    }
  };
}
