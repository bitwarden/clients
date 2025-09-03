import { Component } from "@angular/core";

import { ConfirmKeyConnectorDomainComponent as BaseConfirmKeyConnectorDomainComponent } from "@bitwarden/key-management-ui";
import { RouterService } from "@bitwarden/web-vault/app/core";

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
