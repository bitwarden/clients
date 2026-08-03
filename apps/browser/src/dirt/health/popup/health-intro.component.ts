import { ChangeDetectionStrategy, Component, output } from "@angular/core";

import { TypographyModule, ButtonModule } from "@bitwarden/components";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "health-intro",
  templateUrl: "./health-intro.component.html",
  standalone: true,
  imports: [ButtonModule, TypographyModule],
})
export class HealthIntroComponent {
  readonly onTriggerHealthScan = output<void>();

  readonly handleScanVaultClick = () => {
    this.onTriggerHealthScan.emit();
  };
}
