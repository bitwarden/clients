import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";

import { ButtonComponent, CalloutComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { UpgradeFlowService } from "../../services/upgrade-flow.service";

@Component({
  selector: "app-upgrade-callout",
  imports: [CalloutComponent, ButtonComponent, I18nPipe],
  templateUrl: "./upgrade-callout.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpgradeCalloutComponent {
  private readonly upgradeFlowService = inject(UpgradeFlowService);

  protected readonly dismissed = signal(false);

  protected readonly upgrade = () => this.upgradeFlowService.upgrade();
}
