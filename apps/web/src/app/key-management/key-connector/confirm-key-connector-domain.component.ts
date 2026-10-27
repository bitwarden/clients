import { Component } from "@angular/core";

import {
  OrgInviteKind,
  OrganizationInviteService,
} from "@bitwarden/common/auth/organization-invite";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { ConfirmKeyConnectorDomainComponent as BaseConfirmKeyConnectorDomainComponent } from "@bitwarden/key-management-ui";
import { RouterService } from "@bitwarden/web-vault/app/core";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-confirm-key-connector-domain",
  template: ` <confirm-key-connector-domain [onBeforeNavigation]="onBeforeNavigation" /> `,
  standalone: true,
  imports: [BaseConfirmKeyConnectorDomainComponent],
})
export class ConfirmKeyConnectorDomainComponent {
  constructor(
    private routerService: RouterService,
    private organizationInviteService: OrganizationInviteService,
    private configService: ConfigService,
  ) {}

  onBeforeNavigation = async () => {
    // Key Connector conversion accepts a stashed org invite on the server, so clear the stashed
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
  };
}
