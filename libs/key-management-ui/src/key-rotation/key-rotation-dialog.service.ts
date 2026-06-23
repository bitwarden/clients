import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { LogoutService, UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { ToastService } from "@bitwarden/components";
import { UserId } from "@bitwarden/user-core";
import { UserKeyRotationServiceAbstraction } from "@bitwarden/user-crypto-management";

@Injectable({
  providedIn: "root",
})
export class KeyRotationDialogService {
  private readonly cipherService = inject(CipherService);
  private readonly userKeyRotationService = inject(UserKeyRotationServiceAbstraction);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logoutService = inject(LogoutService);
  private readonly masterPasswordUnlockService = inject(MasterPasswordUnlockService);
  private readonly userDecryptionOptionsService = inject(UserDecryptionOptionsServiceAbstraction);

  /**
   * Rotates the user's account encryption keys if the provided master password is validated via local proof of decryption.
   * If rotation is successful the user will be logged out, on error the user will remain logged in.
   * Note this is a key rotation only not a master password change.
   * @param masterPassword The user's current master password.
   * @param userId The ID of the user.
   * @return True if the key rotation was successful and the dialog should be closed, false if the dialog should remain open.
   */
  async rotateKeys(masterPassword: string, userId: UserId): Promise<boolean> {
    const isMasterPasswordValid = await this.masterPasswordUnlockService.proofOfDecryption(
      masterPassword,
      userId,
    );

    if (!isMasterPasswordValid) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("incorrectPassword"),
      });
      return false;
    }

    // QA (pm-31050-no-logout-key-upgrade-rotation): force regular rotation to behave as an
    // SDK upgrade rotation ("CreateIfNeeded") that does not require a logout, to validate that
    // mobile continues to validly access the account after a client-initiated rotation.
    const success = await this.userKeyRotationService.rotateUserKey(
      { Password: { password: masterPassword } },
      "CreateIfNeeded",
      userId,
    );

    if (success) {
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("accountEncryptionKeyRotated"),
        timeout: 15000,
      });

      // QA: no logout — automatic/upgrade rotation keeps the session alive.
      return true;
    }
    return false;
  }

  /**
   * Rotates the user's account encryption keys for Key Connector users.
   * If rotation is successful the user will be logged out, on error the user will remain logged in.
   * @param userId The ID of the user.
   * @return True if the key rotation was successful and the dialog should be closed, false if the dialog should remain open.
   */
  async rotateKeysForKeyConnector(userId: UserId): Promise<boolean> {
    // Use the Key Connector URL from the identity response rather than from organization
    // data, as the organization profile endpoint is a separate trust boundary.
    // The KC URL from the identity response is trusted because the Key Connector at that URL
    // holds a valid key that was used to decrypt the user key during login.
    const userDecryptionOptions = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptionsById$(userId),
    );
    const keyConnectorUrl = userDecryptionOptions.keyConnectorOption?.keyConnectorUrl;
    if (keyConnectorUrl == null) {
      throw new Error("Key Connector URL not found in user decryption options");
    }

    // QA (pm-31050-no-logout-key-upgrade-rotation): force upgrade rotation without logout.
    const success = await this.userKeyRotationService.rotateUserKey(
      { KeyConnector: { key_connector_url: keyConnectorUrl } },
      "CreateIfNeeded",
      userId,
    );

    if (success) {
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("accountEncryptionKeyRotated"),
        timeout: 15000,
      });

      // QA: no logout — automatic/upgrade rotation keeps the session alive.
      return true;
    }
    return false;
  }

  /**
   * Rotates the user's account encryption keys for TDE users.
   * If rotation is successful the user will be logged out, on error the user will remain logged in.
   * @param userId The ID of the user.
   * @return True if the key rotation was successful and the dialog should be closed, false if the dialog should remain open.
   */
  async rotateKeysForTDE(userId: UserId): Promise<boolean> {
    // TDE keys are rotated as a part of standard key rotation.
    // The call only needs to indicate we're using TDE with no additional metadata required.
    // QA (pm-31050-no-logout-key-upgrade-rotation): force upgrade rotation without logout.
    const success = await this.userKeyRotationService.rotateUserKey(
      "Tde",
      "CreateIfNeeded",
      userId,
    );

    if (success) {
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("accountEncryptionKeyRotated"),
        timeout: 15000,
      });

      // QA: no logout — automatic/upgrade rotation keeps the session alive.
      return true;
    }

    return false;
  }

  /**
   * Checks if the user has any legacy cipher attachments.
   * Legacy cipher attachments are attachments that were encrypted directly by the user's userKey instead of a content encryption key specific to the attachment.
   * Organization attachments are out of scope here as the user key rotation is only concerned with the user's userKey.
   * @param userId The ID of the user.
   * @returns True if the user has legacy cipher attachments, false otherwise.
   */
  async hasLegacyCipherAttachments(userId: UserId): Promise<boolean> {
    const ciphers = await this.cipherService.getAllDecrypted(userId);
    return ciphers?.some((c) => c.organizationId == null && c.hasOldAttachments) ?? false;
  }
}
