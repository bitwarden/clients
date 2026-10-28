import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { CalloutComponent, IconTileComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ImportSummary } from "./import-summary";

@Component({
  selector: "importer-confirmation-summary",
  templateUrl: "./import-confirmation-summary.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalloutComponent, IconTileComponent, I18nPipe, TypographyModule],
  host: { class: "tw-flex tw-flex-col tw-gap-4" },
})
export class ImportConfirmationSummaryComponent {
  readonly summary = input.required<ImportSummary>();
  /** Name of the file the items came from. The delete-the-file tip shows only when set. */
  readonly fileName = input<string>();
  /** False where the host already supplies the title, such as a dialog header. */
  readonly showHeading = input(true);
}
