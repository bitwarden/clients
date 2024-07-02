import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";

import { SetPasswordV2Component as BaseSetPasswordV2Component } from "@bitwarden/angular/auth/components/set-password-v2.component";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { InputPasswordComponent } from "@bitwarden/auth/angular";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";

import { RouterService } from "../core";

import { AcceptOrganizationInviteService } from "./organization-invite/accept-organization.service";

@Component({
  standalone: true,
  selector: "app-set-password-v2",
  templateUrl: "./set-password-v2.component.html",
  imports: [CommonModule, InputPasswordComponent, JslibModule],
})
export class SetPasswordV2Component extends BaseSetPasswordV2Component implements OnInit {
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
