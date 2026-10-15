import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";

import { FormFieldModule, SelectModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { KEEPER_REGION_OPTIONS } from "../keeper/keeper-region-options";

@Component({
  selector: "importer-controls-keeper-credentials",
  templateUrl: "./import-controls-keeper-credentials.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormFieldModule, I18nPipe, ReactiveFormsModule, SelectModule],
  host: { class: "tw-contents" },
})
export class ImportControlsKeeperCredentialsComponent {
  /** The parent's form; uses the keeperEmail and keeperRegion controls. */
  readonly form = input.required<FormGroup>();

  protected readonly regions = KEEPER_REGION_OPTIONS;
}
