import { Component, inject } from "@angular/core";

import { UpdatePasswordComponent as BaseUpdatePasswordComponent } from "@bitwarden/angular/auth/components/update-password.component";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";

import { RouterService } from "../core";

@Component({
  selector: "app-update-password",
  templateUrl: "update-password.component.html",
  standalone: false,
})
export class UpdatePasswordComponent extends BaseUpdatePasswordComponent {
  private routerService = inject(RouterService);
  private organizationInviteService = inject(OrganizationInviteService);

  override async cancel() {
    // clearing the login redirect url so that the user
    // does not join the organization if they cancel
    await this.routerService.getAndClearLoginRedirectUrl();
    await this.organizationInviteService.clearOrganizationInvitation();
    await super.cancel();
  }
}
