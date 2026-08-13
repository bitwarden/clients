import { ChangeDetectionStrategy, Component } from "@angular/core";

import { SpinnerLockupComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * The Scan Progress view, shown while a vault-health scan is running.
 *
 * Presentational only: running the scan and deciding when this view is shown is
 * owned by VaultHealthComponent.
 */
@Component({
  selector: "dirt-scan-progress",
  templateUrl: "./scan-progress.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerLockupComponent, I18nPipe],
})
export class ScanProgressComponent {}
