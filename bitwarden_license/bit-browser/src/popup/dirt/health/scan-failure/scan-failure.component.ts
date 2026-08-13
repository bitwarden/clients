import { ChangeDetectionStrategy, Component } from "@angular/core";

import { AccountWarning } from "@bitwarden/assets/svg";
import { NoItemsModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * The scan-failure state, shown when a vault-health scan does not complete.
 *
 * A failed scan has no data to render, so this replaces the Health Overview
 * entirely. There is deliberately no retry control: the scan re-runs on the next
 * Health tab open, which is the documented recovery path (PM-39223 specifies no
 * manual rescan control).
 */
@Component({
  selector: "dirt-scan-failure",
  templateUrl: "./scan-failure.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NoItemsModule, I18nPipe],
})
export class ScanFailureComponent {
  protected readonly icon = AccountWarning;
}
