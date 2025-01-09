import { Component, inject } from "@angular/core";

import { UpdatePasswordComponent as BaseUpdatePasswordComponent } from "@bitwarden/angular/auth/components/update-password.component";

import { RouterService } from "../core";

import { AcceptOrganizationInviteService } from "./organization-invite/accept-organization.service";

@Component({
  selector: "app-update-password",
  templateUrl: "update-password.component.html",
})
export class UpdatePasswordComponent extends BaseUpdatePasswordComponent {
  private routerService = inject(RouterService);
  private acceptOrganizationInviteService = inject(AcceptOrganizationInviteService);

  override async cancel() {
    // clearing the login redirect url so that the user
    // does not join the organization if they cancel
    await this.routerService.getAndClearLoginRedirectUrl();
    await this.acceptOrganizationInviteService.clearOrganizationInvitation();
    await super.cancel();
  }
}
