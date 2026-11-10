import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { ReportBreach } from "@bitwarden/assets/svg";
import { SvgComponent, StatusLockupComponent, ButtonModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * The Health tab's failure view, shown when the vault-health scan does not
 * complete, or when a report's own check does. Presentational.
 */
@Component({
  selector: "dirt-health-scan-error",
  templateUrl: "./health-scan-error.component.html",
  imports: [SvgComponent, I18nPipe, StatusLockupComponent, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthScanErrorComponent {
  /** Localization key for the heading; the vault scan's by default. */
  readonly titleKey = input("healthScanFailed");
  /** Localization key for the description; the vault scan's by default. */
  readonly descriptionKey = input("healthScanFailedDescription");

  readonly retry = output<void>();

  /** The pages-and-warning illustration the design frame uses for this state. */
  protected readonly illustration = ReportBreach;

  protected readonly onRetryClick = () => {
    this.retry.emit();
  };
}
