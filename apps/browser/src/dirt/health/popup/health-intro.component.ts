import { ChangeDetectionStrategy, Component, output } from "@angular/core";

import { TypographyModule, ButtonModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "health-intro",
  templateUrl: "./health-intro.component.html",
  standalone: true,
  imports: [ButtonModule, TypographyModule, I18nPipe],
})
export class HealthIntroComponent {
  readonly onTriggerHealthScan = output<void>();

  readonly handleScanVaultClick = () => {
    this.onTriggerHealthScan.emit();
  };
}
