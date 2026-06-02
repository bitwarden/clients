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

import {
  ImportRecordError,
  ImportRecordErrorReason,
} from "../../importers/keeper/keeper-import-error";

export interface PartialImportDialogData {
  errors: ImportRecordError[];
  canImport: boolean;
}

interface SkippedItemRow {
  type: string;
  count: number;
}

// Localized label for each Keeper record type. Types not listed here (the pam* family and any custom
// record types) fall back to the "Other" bucket.
const KEEPER_TYPE_I18N_KEYS: Record<string, string> = {
  login: "typeLogin",
  bankCard: "typeCard",
  bankAccount: "bankAccount",
  address: "address",
  contact: "contact",
  file: "file",
  photo: "photo",
  encryptedNotes: "typeSecureNote",
  ssnCard: "ssnCard",
  databaseCredentials: "databaseCredentials",
  serverCredentials: "serverCredentials",
  sshKeys: "typeSshKey",
  softwareLicense: "softwareLicense",
  healthInsurance: "healthInsurance",
  membership: "membership",
  passport: "passport",
  driverLicense: "driverLicense",
  birthCertificate: "birthCertificate",
  general: "general",
  wifiCredentials: "wifiCredentials",
};

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
    this.dataSource.data = this.buildRows(this.data.errors);
  }

  protected continueImport(): void {
    void this.dialogRef.close(true);
  }

  protected cancel(): void {
    void this.dialogRef.close(false);
  }

  private buildRows(errors: ImportRecordError[]): SkippedItemRow[] {
    const counts = new Map<string, number>();
    for (const error of errors) {
      const type = this.typeLabel(error);
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return Array.from(counts, ([type, count]) => ({ type, count }));
  }

  private typeLabel(error: ImportRecordError): string {
    // Folders that could not be decrypted are reported as their own bucket.
    if (error.reason === ImportRecordErrorReason.FolderDecryptionFailed) {
      return this.i18nService.t("folder");
    }

    // Known Keeper types get their label; unmapped types and unreadable items fall back to "Other".
    const mapped = error.type ? KEEPER_TYPE_I18N_KEYS[error.type] : undefined;
    return this.i18nService.t(mapped ?? "other");
  }
}
