import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

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

  protected readonly dismissed = toSignal(this.upgradeFlowService.calloutDismissed$, {
    initialValue: true,
  });

  protected readonly upgrade = () => this.upgradeFlowService.upgrade();

  protected readonly dismiss = () => this.upgradeFlowService.dismissCallout();
}
