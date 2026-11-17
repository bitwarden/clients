import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";

import {
  CalloutModule,
  FormFieldModule,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ImporterProfile } from "../../services";

import { ImportInstructionsCalloutComponent } from "./import-instructions-callout.component";

@Component({
  selector: "importer-controls-chromium",
  templateUrl: "./import-controls-chromium.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CalloutModule,
    FormFieldModule,
    I18nPipe,
    ImportInstructionsCalloutComponent,
    ReactiveFormsModule,
    SelectModule,
    TypographyModule,
  ],
  host: { class: "tw-contents" },
})
export class ImportControlsChromiumComponent {
  /** The parent's form; only the `profile` control is used. */
  readonly form = input.required<FormGroup>();
  readonly vendorName = input.required<string>();
  readonly instructionKey = input<string>();
  readonly instructionLink = input<string>();
  readonly profiles = input.required<readonly ImporterProfile[]>();
  readonly profilesError = input<string>();
}
