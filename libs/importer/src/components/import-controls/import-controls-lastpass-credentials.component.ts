import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";

import { CheckboxModule, FormFieldModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "importer-controls-lastpass-credentials",
  templateUrl: "./import-controls-lastpass-credentials.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CheckboxModule, FormFieldModule, I18nPipe, ReactiveFormsModule],
  host: { class: "tw-contents" },
})
export class ImportControlsLastPassCredentialsComponent {
  /** The parent's form; uses the lastPassEmail and includeSharedFolders controls. */
  readonly form = input.required<FormGroup>();
}
