import { ChangeDetectionStrategy, Component } from "@angular/core";

import { ReportBreach } from "@bitwarden/assets/svg";
import { SvgComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * The Health tab's failure view, shown when the vault-health scan does not
 * complete. Presentational.
 *
 * There is no retry control. The design frame shows a "Try again" button, but
 * the acceptance criteria state the tab has no manual rescan control, and the
 * criteria govern. The scan runs automatically on every Health tab open, so
 * reopening the tab is the recovery path.
 */
@Component({
  selector: "dirt-health-scan-error",
  templateUrl: "./health-scan-error.component.html",
  imports: [SvgComponent, TypographyModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthScanErrorComponent {
  /** The pages-and-warning illustration the design frame uses for this state. */
  protected readonly illustration = ReportBreach;
}
