import { inject } from "@angular/core";

import {
  DefaultSetInitialPasswordService,
  SetInitialPasswordCredentials,
  SetInitialPasswordService,
  SetInitialPasswordUserType,
} from "@bitwarden/auth/angular";
import { UserId } from "@bitwarden/common/types/guid";

import { RouterService } from "../../../../core/router.service";
import { AcceptOrganizationInviteService } from "../../../organization-invite/accept-organization.service";

export class WebSetInitialPasswordService
  extends DefaultSetInitialPasswordService
  implements SetInitialPasswordService
{
  routerService = inject(RouterService);
  acceptOrganizationInviteService = inject(AcceptOrganizationInviteService);

  override async setInitialPassword(
    credentials: SetInitialPasswordCredentials,
    userType: SetInitialPasswordUserType,
    userId: UserId,
  ) {
    await super.setInitialPassword(credentials, userType, userId);

    // SSO JIT accepts org invites when setting their MP, meaning
    // we can clear the deep linked url for accepting it.
    await this.routerService.getAndClearLoginRedirectUrl();
    await this.acceptOrganizationInviteService.clearOrganizationInvitation();
  }
}
