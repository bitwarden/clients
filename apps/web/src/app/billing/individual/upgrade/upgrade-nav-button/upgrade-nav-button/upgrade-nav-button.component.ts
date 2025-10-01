import { Component, inject } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";
import { UpgradeFlowService } from "@bitwarden/web-vault/app/billing/individual/upgrade/services";

@Component({
  selector: "app-upgrade-nav-button",
  imports: [I18nPipe],
  templateUrl: "./upgrade-nav-button.component.html",
  standalone: true,
})
export class UpgradeNavButtonComponent {
  private upgradeFlowService: UpgradeFlowService;
  constructor() {
    this.upgradeFlowService = inject(UpgradeFlowService);
  }
  openUpgradeDialog = async () => {
    await this.upgradeFlowService.startUpgradeFlow(true, "upgradeYourPlan");
  };
}
