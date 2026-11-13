import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { AutofocusDirective, ButtonModule, DIALOG_DATA, DialogModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ImportedFile } from "../../models";

import { ImportConfirmationSummaryComponent } from "./import-confirmation-summary.component";
import { ImportSummary } from "./import-summary";

/** Counts and file name only: the decrypted items stay out of the dialog's data. */
export interface ImportConfirmationDialogData {
  summary: ImportSummary;
  /** Set for file imports, to remind the user to delete the file. */
  importedFile?: ImportedFile;
}

@Component({
  templateUrl: "./import-confirmation-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AutofocusDirective,
    ButtonModule,
    DialogModule,
    I18nPipe,
    ImportConfirmationSummaryComponent,
  ],
})
export class ImportConfirmationDialogComponent {
  protected readonly data = inject<ImportConfirmationDialogData>(DIALOG_DATA);
}
