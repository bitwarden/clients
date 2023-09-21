import { Component } from "@angular/core";

import { BaseLoginDecryptionOptionsComponent } from "@bitwarden/angular/auth/components/base-login-decryption-options.component";

@Component({
  selector: "desktop-login-decryption-options",
  templateUrl: "login-decryption-options.component.html",
})
export class LoginDecryptionOptionsComponent extends BaseLoginDecryptionOptionsComponent {
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
