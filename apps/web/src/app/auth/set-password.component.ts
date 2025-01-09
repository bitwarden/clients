import { Component, inject } from "@angular/core";

import { SetPasswordComponent as BaseSetPasswordComponent } from "@bitwarden/angular/auth/components/set-password.component";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";

import { RouterService } from "../core";

import { AcceptOrganizationInviteService } from "./organization-invite/accept-organization.service";

@Component({
  selector: "app-set-password",
  templateUrl: "set-password.component.html",
})
export class SetPasswordComponent extends BaseSetPasswordComponent {
  routerService = inject(RouterService);
  acceptOrganizationInviteService = inject(AcceptOrganizationInviteService);

  protected override async onSetPasswordSuccess(
    masterKey: MasterKey,
    userKey: [UserKey, EncString],
    keyPair: [string, EncString],
  ): Promise<void> {
    await super.onSetPasswordSuccess(masterKey, userKey, keyPair);
    // SSO JIT accepts org invites when setting their MP, meaning
    // we can clear the deep linked url for accepting it.
    await this.routerService.getAndClearLoginRedirectUrl();
    await this.acceptOrganizationInviteService.clearOrganizationInvitation();
  }
}
