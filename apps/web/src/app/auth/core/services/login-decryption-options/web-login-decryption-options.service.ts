// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  LoginDecryptionOptionsService,
  DefaultLoginDecryptionOptionsService,
} from "@bitwarden/auth/angular";
import { OrganizationInviteService } from "@bitwarden/common/auth/organization-invite";
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
      // TDE org invites are accepted during admin recovery enrollment on the server, so clear the stashed
      // invite and its accept URL redirect. Without a stashed invite, the redirect is an
      // unrelated deep link which we don't want to clear.
      if ((await this.organizationInviteService.getOrganizationInvite()) != null) {
        await this.routerService.getAndClearLoginRedirectUrl();
        await this.organizationInviteService.clearOrganizationInvite();
      }
    } catch (error) {
      throw new Error(error);
    }
  }
}
