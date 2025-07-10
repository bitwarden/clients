import { Injectable } from "@angular/core";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CipherRepromptType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";

import { PasswordRepromptComponent } from "../components/password-reprompt.component";

/**
 * Used to verify the user's Master Password for the "Master Password Re-prompt" feature only.
 * See UserVerificationService for any other situation where you need to verify the user's identity.
 */
@Injectable()
export class PasswordRepromptService {
  constructor(
    private dialogService: DialogService,
    private userVerificationService: UserVerificationService,
  ) {}

  enabled$ = Utils.asyncToObservable(() =>
    this.userVerificationService.hasMasterPasswordAndMasterKeyHash(),
  );

  protectedFields() {
    return ["TOTP", "Password", "H_Field", "Card Number", "Security Code"];
  }

  async passwordRepromptCheck(cipher: CipherView) {
    if (cipher.reprompt === CipherRepromptType.None) {
      return true;
    }

    return await this.showPasswordPrompt();
  }

  async showPasswordPrompt() {
    if (!(await this.enabled())) {
      return true;
    }

    const dialog = this.dialogService.open<boolean>(PasswordRepromptComponent, {
      ariaModal: true,
    });

    const result = await lastValueFrom(dialog.closed);

    return result === true;
  }

  enabled() {
    return firstValueFrom(this.enabled$);
  }
}
