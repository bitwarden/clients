import { Component } from "@angular/core";

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
  constructor(private routerService: RouterService) {}

  onBeforeNavigation = async () => {
    await this.routerService.getAndClearLoginRedirectUrl();
  };
}
