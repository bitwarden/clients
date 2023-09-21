import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";

import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { SharedModule } from "../../shared";

import { MigrateFromLegacyEncryptionService } from "./migrate-legacy-encryption.service";

// The master key was originally used to encrypt user data, before the user key was introduced.
// This component is used to migrate from the old encryption scheme to the new one.
@Component({
  standalone: true,
  imports: [SharedModule],
  providers: [MigrateFromLegacyEncryptionService],
  templateUrl: "migrate-legacy-encryption.component.html",
})
export class MigrateFromLegacyEncryptionComponent {
  protected formGroup = new FormGroup({
    masterPassword: new FormControl("", [Validators.required]),
  });

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private migrationService: MigrateFromLegacyEncryptionService,
    private cryptoService: CryptoService,
    private messagingService: MessagingService,
    private logService: LogService
  ) {}

  submit = async () => {
    this.formGroup.markAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    const hasUserKey = await this.cryptoService.hasUserKey();
    if (hasUserKey) {
      this.messagingService.send("logout");
      throw new Error("User key already exists, cannot migrate legacy encryption.");
    }

    const masterPassword = this.formGroup.value.masterPassword;

    try {
      // Create new user key
      const [newUserKey, masterKeyEncUserKey] = await this.migrationService.createNewUserKey(
        masterPassword
      );

      // Update admin recover keys
      await this.migrationService.updateAllAdminRecoveryKeys(masterPassword, newUserKey);

      // Update emergency access
      await this.migrationService.updateEmergencyAccesses(newUserKey);

      // Update keys, folders, ciphers, and sends
      await this.migrationService.updateKeysAndEncryptedData(
        masterPassword,
        newUserKey,
        masterKeyEncUserKey
      );

      this.platformUtilsService.showToast(
        "success",
        this.i18nService.t("keyUpdated"),
        this.i18nService.t("logBackInOthersToo"),
        { timeout: 15000 }
      );
      this.messagingService.send("logout");
    } catch (e) {
      this.logService.error(e);
      throw e;
    }
  };
}
