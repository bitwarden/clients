// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  LoginDecryptionOptionsService,
  DefaultLoginDecryptionOptionsService,
} from "@bitwarden/auth/angular";
import { OrganizationInviteService } from "@bitwarden/common/auth/organization-invite";

import { RouterService } from "../../../../core/router.service";

export class WebLoginDecryptionOptionsService
  extends DefaultLoginDecryptionOptionsService
  implements LoginDecryptionOptionsService
{
  constructor(
    private routerService: RouterService,
    private organizationInviteService: OrganizationInviteService,
  ) {
    super();
  }

  override async handleCreateUserSuccess(organizationInviteAccepted: boolean): Promise<void> {
    try {
      // When we send `acceptOrganizationInvite: true` for the TDE org invite, clear the stashed
      // invite and its accept URL redirect. Without a stashed invite, the redirect is an unrelated
      // deep link which we don't want to clear.
      //
      // Exception: when we send `acceptOrganizationInvite: false`, the organization user stays
      // Invited, so keep the open invite and its /join redirect. `deepLinkGuard` then sends the
      // user to AcceptOrgOpenInviteComponent, which runs the Admin Console accept flow.
      // `SsoJitProvisionFinishService.shouldAcceptOrganizationInvite` makes this decision.
      if (
        organizationInviteAccepted &&
        (await this.organizationInviteService.getOrganizationInvite()) != null
      ) {
        await this.routerService.getAndClearLoginRedirectUrl();
        await this.organizationInviteService.clearOrganizationInvite();
      }
    } catch (error) {
      throw new Error(error);
    }
  }
}
