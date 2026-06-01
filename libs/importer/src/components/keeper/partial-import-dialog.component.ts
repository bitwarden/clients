import { CommonModule } from "@angular/common";
import { Component, Inject, OnInit } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  DialogRef,
  DIALOG_DATA,
  ButtonModule,
  DialogModule,
  TableDataSource,
} from "@bitwarden/components";

import {
  ImportRecordError,
  ImportRecordErrorReason,
} from "../../importers/keeper/keeper-import-error";

export interface PartialImportDialogData {
  errors: ImportRecordError[];
  canImport: boolean;
}

interface PartialImportRow {
  name: string;
  reasonKey: string;
}

const REASON_I18N_KEYS: Record<ImportRecordErrorReason, string> = {
  [ImportRecordErrorReason.Error]: "importRecordErrorGeneric",
  [ImportRecordErrorReason.UnsupportedFeature]: "importRecordErrorUnsupportedFeature",
  [ImportRecordErrorReason.UnsupportedType]: "importRecordErrorUnsupportedType",
  [ImportRecordErrorReason.FolderDecryptionFailed]: "importRecordErrorFolderDecryptionFailed",
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./partial-import-dialog.component.html",
  imports: [CommonModule, JslibModule, DialogModule, ButtonModule],
})
export class PartialImportDialogComponent implements OnInit {
  protected dataSource = new TableDataSource<PartialImportRow>();

  constructor(
    public dialogRef: DialogRef<boolean>,
    @Inject(DIALOG_DATA) public data: PartialImportDialogData,
  ) {}

  ngOnInit(): void {
    this.dataSource.data = this.data.errors.map((error) => ({
      name: error.name,
      reasonKey: REASON_I18N_KEYS[error.reason] ?? "importRecordErrorGeneric",
    }));
  }

  protected importAnyway(): void {
    void this.dialogRef.close(true);
  }

  protected cancel(): void {
    void this.dialogRef.close(false);
  }
}
