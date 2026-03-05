// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  LoginDecryptionOptionsService,
  DefaultLoginDecryptionOptionsService,
} from "@bitwarden/auth/angular";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { RouterService } from "../../../../core/router.service";

export class WebLoginDecryptionOptionsService
  extends DefaultLoginDecryptionOptionsService
  implements LoginDecryptionOptionsService
{
  constructor(
    protected messagingService: MessagingService,
    private routerService: RouterService,
    private organizationInviteService: OrganizationInviteService,
  ) {
    super(messagingService);
  }

  override async handleCreateUserSuccess(): Promise<void> {
    try {
      // Invites from TDE orgs go through here, but the invite is
      // accepted while being enrolled in admin recovery. So we need to clear
      // the redirect and stored org invite.
      await this.routerService.getAndClearLoginRedirectUrl();
      await this.organizationInviteService.clearOrganizationInvitation();
    } catch (error) {
      throw new Error(error);
    }
  }
}
