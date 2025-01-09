import { Component } from "@angular/core";

import { BaseLoginDecryptionOptionsComponentV1 } from "@bitwarden/angular/auth/components/base-login-decryption-options-v1.component";

@Component({
  selector: "desktop-login-decryption-options",
  templateUrl: "login-decryption-options-v1.component.html",
})
export class LoginDecryptionOptionsComponentV1 extends BaseLoginDecryptionOptionsComponentV1 {
  override async createUser(): Promise<void> {
    try {
      await super.createUser();
      this.messagingService.send("redrawMenu");
      await this.router.navigate(["/vault"]);
    } catch (error) {
      this.validationService.showError(error);
    }
  }
}
