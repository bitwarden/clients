import { ChangeDetectionStrategy, Component } from "@angular/core";

import { IconModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * The Health tab's progress view, shown while the vault-health scan is running.
 * Presentational: the Health tab root owns the scan and decides when this is on
 * screen.
 */
@Component({
  selector: "dirt-health-scanning",
  templateUrl: "./health-scanning.component.html",
  imports: [IconModule, TypographyModule, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthScanningComponent {}
