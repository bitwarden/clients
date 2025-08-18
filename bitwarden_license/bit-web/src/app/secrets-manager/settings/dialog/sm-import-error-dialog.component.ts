import { Component, Inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, DIALOG_DATA } from "@bitwarden/components";

import { SecretsManagerImportError } from "../models/error/sm-import-error";
import { SecretsManagerImportErrorLine } from "../models/error/sm-import-error-line";

export interface SecretsManagerImportErrorDialogOperation {
  error: SecretsManagerImportError;
}

@Component({
  templateUrl: "./sm-import-error-dialog.component.html",
  standalone: false,
})
export class SecretsManagerImportErrorDialogComponent {
  errorLines: SecretsManagerImportErrorLine[];

  constructor(
    public dialogRef: DialogRef,
    private i18nService: I18nService,
    @Inject(DIALOG_DATA) public data: SecretsManagerImportErrorDialogOperation,
  ) {
    this.errorLines = data.error.lines;
  }
}
