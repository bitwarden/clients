import { CommonModule } from "@angular/common";
import { Component, Inject, OnInit } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DialogRef,
  DIALOG_DATA,
  ButtonModule,
  DialogModule,
  TableDataSource,
  TableModule,
} from "@bitwarden/components";

import { ImportRecordError } from "../../importers/keeper/keeper-import-error";

export interface PartialImportDialogData {
  errors: ImportRecordError[];
  canImport: boolean;
}

interface SkippedItemRow {
  name: string;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./partial-import-dialog.component.html",
  imports: [CommonModule, JslibModule, DialogModule, ButtonModule, TableModule],
})
export class PartialImportDialogComponent implements OnInit {
  protected dataSource = new TableDataSource<SkippedItemRow>();

  constructor(
    public dialogRef: DialogRef<boolean>,
    @Inject(DIALOG_DATA) public data: PartialImportDialogData,
    private readonly i18nService: I18nService,
  ) {}

  ngOnInit(): void {
    // Items that could not be read have no decrypted title, so they show as "Unknown".
    const unknown = this.i18nService.t("unknown");
    this.dataSource.data = this.data.errors.map((error) => ({ name: error.name || unknown }));
  }

  protected continueImport(): void {
    void this.dialogRef.close(true);
  }

  protected cancel(): void {
    void this.dialogRef.close(false);
  }
}
