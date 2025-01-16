import { Component, inject } from "@angular/core";

import { BaseLoginDecryptionOptionsComponentV1 } from "@bitwarden/angular/auth/components/base-login-decryption-options-v1.component";

import { RouterService } from "../../../core";
import { AcceptOrganizationInviteService } from "../../organization-invite/accept-organization.service";
@Component({
  selector: "web-login-decryption-options",
  templateUrl: "login-decryption-options-v1.component.html",
})
export class LoginDecryptionOptionsComponentV1 extends BaseLoginDecryptionOptionsComponentV1 {
  protected routerService = inject(RouterService);
  protected acceptOrganizationInviteService = inject(AcceptOrganizationInviteService);

  override async createUser(): Promise<void> {
    try {
      await super.createUser();

      // Invites from TDE orgs go through here, but the invite is
      // accepted while being enrolled in admin recovery. So we need to clear
      // the redirect and stored org invite.
      await this.routerService.getAndClearLoginRedirectUrl();
      await this.acceptOrganizationInviteService.clearOrganizationInvitation();

      await this.router.navigate(["/vault"]);
    } catch (error) {
      this.validationService.showError(error);
    }
  }

  createUserAction = async (): Promise<void> => {
    return this.createUser();
  };
}
