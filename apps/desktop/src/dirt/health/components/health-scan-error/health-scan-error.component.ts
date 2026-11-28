import { ChangeDetectionStrategy, Component, output } from "@angular/core";

import { ReportBreach } from "@bitwarden/assets/svg";
import { SvgComponent, StatusLockupComponent, ButtonModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** The Health tab's failure view, shown when the vault-health scan does not complete. */
@Component({
  selector: "dirt-health-scan-error",
  templateUrl: "./health-scan-error.component.html",
  imports: [SvgComponent, I18nPipe, StatusLockupComponent, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthScanErrorComponent {
  readonly retry = output<void>();

  protected readonly illustration = ReportBreach;

  protected readonly onRetryClick = () => {
    this.retry.emit();
  };
}
