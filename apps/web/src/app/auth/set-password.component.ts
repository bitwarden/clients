import { Component, inject } from "@angular/core";

import { SetPasswordComponent as BaseSetPasswordComponent } from "@bitwarden/angular/auth/components/set-password.component";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";

import { RouterService } from "../core";

@Component({
  selector: "app-set-password",
  templateUrl: "set-password.component.html",
  standalone: false,
})
export class SetPasswordComponent extends BaseSetPasswordComponent {
  routerService = inject(RouterService);
  organizationInviteService = inject(OrganizationInviteService);

  protected override async onSetPasswordSuccess(
    masterKey: MasterKey,
    userKey: [UserKey, EncString],
    keyPair: [string, EncString],
  ): Promise<void> {
    await super.onSetPasswordSuccess(masterKey, userKey, keyPair);
    // SSO JIT accepts org invites when setting their MP, meaning
    // we can clear the deep linked url for accepting it.
    await this.routerService.getAndClearLoginRedirectUrl();
    await this.organizationInviteService.clearOrganizationInvitation();
  }
}
