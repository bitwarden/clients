import { inject } from "@angular/core";

import {
  DefaultSetPasswordJitService,
  SetPasswordCredentials,
  SetPasswordJitService,
} from "@bitwarden/auth/angular";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";

import { RouterService } from "../../../../core/router.service";

export class WebSetPasswordJitService
  extends DefaultSetPasswordJitService
  implements SetPasswordJitService
{
  routerService = inject(RouterService);
  organizationInviteService = inject(OrganizationInviteService);

  override async setPassword(credentials: SetPasswordCredentials) {
    await super.setPassword(credentials);

    // SSO JIT accepts org invites when setting their MP, meaning
    // we can clear the deep linked url for accepting it.
    await this.routerService.getAndClearLoginRedirectUrl();
    await this.organizationInviteService.clearOrganizationInvitation();
  }
}
