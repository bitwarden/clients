import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { SpinnerComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** The spinner card shown while Keeper waits on an approver rather than the user. */
@Component({
  selector: "importer-controls-keeper-waiting",
  templateUrl: "./import-controls-keeper-waiting.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18nPipe, SpinnerComponent, TypographyModule],
  host: { class: "tw-contents" },
})
export class ImportControlsKeeperWaitingComponent {
  // Named *Key, not title/body: a `title` input would also put a native title attribute on the host.
  readonly titleKey = input<string>();
  readonly bodyKey = input<string>();
}
