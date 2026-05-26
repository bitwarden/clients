import { inject, Injectable } from "@angular/core";

import { LogoutService } from "@bitwarden/auth/common";
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

    const success = await this.userKeyRotationService.rotateUserKey(
      { Password: { password: masterPassword } },
      "Skip",
      userId,
    );

    if (success) {
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("accountEncryptionKeyRotated"),
        timeout: 15000,
      });

      await this.logoutService.logout(userId);
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
