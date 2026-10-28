// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  LoginDecryptionOptionsService,
  DefaultLoginDecryptionOptionsService,
} from "@bitwarden/auth/angular";
import {
  OrgInviteKind,
  OrganizationInviteService,
} from "@bitwarden/common/auth/organization-invite";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { RouterService } from "../../../../core/router.service";

export class WebLoginDecryptionOptionsService
  extends DefaultLoginDecryptionOptionsService
  implements LoginDecryptionOptionsService
{
  constructor(
    private routerService: RouterService,
    private organizationInviteService: OrganizationInviteService,
    private configService: ConfigService,
  ) {
    super();
  }

  override async handleCreateUserSuccess(): Promise<void> {
    try {
      // TDE org invites are accepted during admin recovery enrollment on the server, so clear the stashed
      // invite and its accept URL redirect. The exception is an open invite while
      // InviteLinkAutoConfirm is on: keep it and its /join redirect so the user lands on the accept
      // open org invite component. Without a stashed invite, the redirect is an
      // unrelated deep link which we don't want to clear.
      const invite = await this.organizationInviteService.getOrganizationInvite();
      const inviteLinkAutoConfirmEnabled = await this.configService.getFeatureFlag(
        FeatureFlag.InviteLinkAutoConfirm,
      );

      // Keep an open org invite and its saved /join URL, so deepLinkGuard sends the user
      // to the accept open org invite component.
      if (invite != null && !(inviteLinkAutoConfirmEnabled && invite.kind === OrgInviteKind.Open)) {
        await this.routerService.getAndClearLoginRedirectUrl();
        await this.organizationInviteService.clearOrganizationInvite();
      }
    } catch (error) {
      throw new Error(error);
    }
  }
}
