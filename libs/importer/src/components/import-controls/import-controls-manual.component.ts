import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";

import {
  FileUploadComponent,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
  RadioButtonModule,
  SelectModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ImportInstructionsCalloutComponent } from "./import-instructions-callout.component";

@Component({
  selector: "importer-controls-manual",
  templateUrl: "./import-controls-manual.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FileUploadComponent,
    FormFieldModule,
    I18nPipe,
    IconButtonModule,
    ImportInstructionsCalloutComponent,
    LinkModule,
    RadioButtonModule,
    ReactiveFormsModule,
    SelectModule,
    TypographyModule,
  ],
  host: { class: "tw-contents" },
})
export class ImportControlsManualComponent {
  /** The parent's form; uses the method, formatChoice, kdbx, file password, file and paste controls. */
  readonly form = input.required<FormGroup>();
  readonly vendorName = input.required<string>();
  readonly instructionKey = input<string>();
  readonly instructionLink = input<string>();
  readonly method = input.required<"file" | "paste">();
  readonly needsFilePassword = input.required<boolean>();
  readonly formatChoiceActive = input.required<boolean>();
  readonly formatChoiceItems = input.required<readonly { id: string; label: string }[]>();
  readonly needsKdbxCredentials = input.required<boolean>();
  readonly showKeyFile = input.required<boolean>();
  readonly fileAccept = input.required<string>();
  readonly acceptedFileTypesHint = input.required<string>();
  readonly pasteFormatsHint = input.required<string>();

  readonly addKeyFile = output<void>();
}
