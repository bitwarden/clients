import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { SpinnerComponent, TypographyModule } from "@bitwarden/components";

@Component({
  selector: "importer-progress",
  templateUrl: "./import-progress.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent, TypographyModule],
  host: { class: "tw-block" },
})
export class ImportProgressComponent {
  /** Already translated. */
  readonly heading = input.required<string>();
  readonly description = input<string>();
}
