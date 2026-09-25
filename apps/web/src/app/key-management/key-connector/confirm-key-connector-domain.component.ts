import { Component } from "@angular/core";

import { OrganizationInviteService } from "@bitwarden/common/auth/organization-invite";
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
  ) {}

  onBeforeNavigation = async () => {
    // Key Connector conversion accepts a stashed org invite on the server, so clear the stashed
    // invite and its accept URL redirect. Without a stashed invite, the redirect is an
    // unrelated deep link which we don't want to clear.
    if ((await this.organizationInviteService.getOrganizationInvite()) != null) {
      await this.routerService.getAndClearLoginRedirectUrl();
      await this.organizationInviteService.clearOrganizationInvite();
    }
  };
}
