// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";

import { UserVerificationDialogComponent } from "@bitwarden/auth/angular";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { PasswordRepromptService } from "@bitwarden/vault";

// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { SetPinComponent } from "../../auth/popup/components/set-pin.component";

export class Fido2UserVerificationService {
  constructor(
    private passwordRepromptService: PasswordRepromptService,
    private userVerificationService: UserVerificationService,
    private dialogService: DialogService,
  ) {}

  /**
   * Handles user verification for a user based on the cipher and user verification requested.
   * @param userVerificationRequested Indicates if user verification is required or not.
   * @param cipher Contains details about the cipher including master password reprompt.
   * @param fromLock Indicates if the request is from the lock screen.
   * @returns
   */
  async handleUserVerification(
    userVerificationRequested: boolean,
    cipher: CipherView,
    fromLock: boolean,
  ): Promise<boolean> {
    const masterPasswordRepromptRequired = cipher && cipher.reprompt !== 0;

    // If the request is from the lock screen, treat unlocking the vault as user verification,
    // unless a master password reprompt is required.
    if (fromLock) {
      return masterPasswordRepromptRequired
        ? await this.handleMasterPasswordReprompt()
        : userVerificationRequested;
    }

    if (masterPasswordRepromptRequired) {
      return await this.handleMasterPasswordReprompt();
    }

    if (userVerificationRequested) {
      return await this.showUserVerificationDialog();
    }

    return userVerificationRequested;
  }

  private async showMasterPasswordReprompt(): Promise<boolean> {
    return await this.passwordRepromptService.showPasswordPrompt();
  }

  private async showUserVerificationDialog(): Promise<boolean> {
    const result = await UserVerificationDialogComponent.open(this.dialogService, {
      verificationType: "client",
    });

    if (result.userAction === "cancel") {
      return;
    }

    // Handle unsuccessful verification attempts.
    if (!result.verificationSuccess) {
      // Check if no client-side verification methods are available.
      if (result.noAvailableClientVerificationMethods) {
        return await this.promptUserToSetPin();
      }
      return;
    }

    return result.verificationSuccess;
  }

  private async handleMasterPasswordReprompt(): Promise<boolean> {
    const hasMasterPassword = await this.userVerificationService.hasMasterPassword();

    // TDE users have no master password, so we need to use the UserVerification prompt
    return hasMasterPassword
      ? await this.showMasterPasswordReprompt()
      : await this.showUserVerificationDialog();
  }

  private async promptUserToSetPin() {
    const dialogRef = SetPinComponent.open(this.dialogService);

    if (!dialogRef) {
      return;
    }

    const userHasPinSet = await firstValueFrom(dialogRef.closed);

    if (!userHasPinSet) {
      return;
    }

    // If the user has set a PIN, re-invoke the user verification dialog to complete the verification process.
    return await this.showUserVerificationDialog();
  }
}
