import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DialogRef,
  DIALOG_DATA,
  ButtonModule,
  DialogModule,
  TableDataSource,
  TableModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ImportRecordError, ImportRecordErrorReason } from "../../models/import-record-error";

export interface ImportSkippedItemsDialogData {
  errors: ImportRecordError[];
  returnUrl?: string;
  returnLabel?: string;
}

interface SkippedItemRow {
  id: string;
  reason: string;
}

const REASON_I18N_KEYS: Record<ImportRecordErrorReason, string> = {
  [ImportRecordErrorReason.SshKeyParseFailed]: "importSkipReasonSshKeyParse",
  [ImportRecordErrorReason.UnsupportedType]: "importSkipReasonUnsupportedType",
  [ImportRecordErrorReason.UnsupportedFeature]: "importSkipReasonGeneric",
  [ImportRecordErrorReason.FolderDecryptionFailed]: "importSkipReasonGeneric",
  [ImportRecordErrorReason.Error]: "importSkipReasonGeneric",
};

@Component({
  templateUrl: "./import-skipped-items-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, I18nPipe, DialogModule, ButtonModule, TableModule],
})
export class ImportSkippedItemsDialogComponent {
  private readonly i18nService = inject(I18nService);
  private readonly router = inject(Router);
  protected readonly dialogRef = inject(DialogRef);
  protected readonly data = inject<ImportSkippedItemsDialogData>(DIALOG_DATA);

  protected readonly dataSource = new TableDataSource<SkippedItemRow>();

  protected readonly hasReturnDestination = !!this.data.returnUrl && !!this.data.returnLabel;

  protected readonly titleKey =
    this.data.errors.length === 1 ? "importPartialErrorTitleSingular" : "importPartialErrorTitle";

  constructor() {
    this.dataSource.data = this.data.errors.map((error) => ({
      id: error.id?.trim() ? error.id : "—",
      reason: this.i18nService.t(REASON_I18N_KEYS[error.reason]),
    }));
  }

  protected acknowledge(): void {
    void this.dialogRef.close(true);
  }

  protected navigateBack(): void {
    void this.dialogRef.close(true);
    if (this.data.returnUrl) {
      void this.router.navigateByUrl(this.data.returnUrl);
    }
  }
}
