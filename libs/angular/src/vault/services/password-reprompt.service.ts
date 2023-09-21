import { Injectable } from "@angular/core";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { PasswordRepromptService as PasswordRepromptServiceAbstraction } from "@bitwarden/common/vault/abstractions/password-reprompt.service";

import { ModalService } from "../../services/modal.service";
import { PasswordRepromptComponent } from "../components/password-reprompt.component";

/**
 * Used to verify the user's Master Password for the "Master Password Re-prompt" feature only.
 * See UserVerificationService for any other situation where you need to verify the user's identity.
 */
@Injectable()
export class PasswordRepromptService implements PasswordRepromptServiceAbstraction {
  protected component = PasswordRepromptComponent;

  constructor(
    private modalService: ModalService,
    private userVerificationService: UserVerificationService
  ) {}

  protectedFields() {
    return ["TOTP", "Password", "H_Field", "Card Number", "Security Code"];
  }

  async showPasswordPrompt() {
    if (!(await this.enabled())) {
      return true;
    }

    const ref = this.modalService.open(this.component, { allowMultipleModals: true });

    if (ref == null) {
      return false;
    }

    const result = await ref.onClosedPromise();
    return result === true;
  }

  async enabled() {
    return await this.userVerificationService.hasMasterPasswordAndMasterKeyHash();
  }
}
