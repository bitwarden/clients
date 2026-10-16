import { Component, Inject } from "@angular/core";

import { SecretsManagerImportError } from "@bitwarden/bit-common/secrets-manager/settings/models/error/sm-import-error";
import { SecretsManagerImportErrorLine } from "@bitwarden/bit-common/secrets-manager/settings/models/error/sm-import-error-line";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogRef, DIALOG_DATA } from "@bitwarden/components";

export interface SecretsManagerImportErrorDialogOperation {
  error: SecretsManagerImportError;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
