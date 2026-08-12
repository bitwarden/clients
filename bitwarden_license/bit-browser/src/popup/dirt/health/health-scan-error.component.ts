import { ChangeDetectionStrategy, Component } from "@angular/core";

import { IconComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * The Health tab's failure view, shown when the vault-health scan does not
 * complete. Presentational.
 *
 * There is no retry control: the scan runs automatically on every Health tab
 * open, so reopening the tab is the retry path.
 */
@Component({
  selector: "dirt-health-scan-error",
  templateUrl: "./health-scan-error.component.html",
  imports: [IconComponent, TypographyModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthScanErrorComponent {}
