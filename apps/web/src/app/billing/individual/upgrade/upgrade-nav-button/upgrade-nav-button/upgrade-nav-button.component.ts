import { Component, inject } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { UpgradeFlowService } from "../../services/upgrade-flow.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-upgrade-nav-button",
  imports: [I18nPipe],
  templateUrl: "./upgrade-nav-button.component.html",
  standalone: true,
})
export class UpgradeNavButtonComponent {
  private readonly upgradeFlowService = inject(UpgradeFlowService);

  upgrade = () => this.upgradeFlowService.upgrade();
}
