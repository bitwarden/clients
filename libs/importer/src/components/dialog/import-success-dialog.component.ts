import { CommonModule } from "@angular/common";
import { Component, Inject, OnInit } from "@angular/core";
import { Router } from "@angular/router";

import { CipherType } from "@bitwarden/common/vault/enums";
import {
  DialogRef,
  DIALOG_DATA,
  ButtonModule,
  DialogModule,
  TableDataSource,
  TableModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ImportResult, SdkImportSummary } from "../../models";

export interface ImportSuccessDialogData {
  /** Result of a client-side importer. Mutually exclusive with {@link sdkSummary}. */
  importResult?: ImportResult;
  /** Counts from an SDK-backed importer that submitted directly. Mutually exclusive with importResult. */
  sdkSummary?: SdkImportSummary;
  returnUrl?: string;
  returnLabel?: string;
}

export interface ResultList {
  icon: string;
  type: string;
  count: number;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./import-success-dialog.component.html",
  imports: [CommonModule, I18nPipe, DialogModule, TableModule, ButtonModule],
})
export class ImportSuccessDialogComponent implements OnInit {
  protected dataSource = new TableDataSource<ResultList>();

  protected get hasReturnDestination(): boolean {
    return !!this.data.returnUrl && !!this.data.returnLabel;
  }

  protected get totalImported(): number {
    if (this.data.sdkSummary != null) {
      return this.data.sdkSummary.ciphers.reduce((total, c) => total + c.count, 0);
    }
    return this.data.importResult?.ciphers.length ?? 0;
  }

  private readonly cipherTypeRows: { type: CipherType; icon: string; label: string }[] = [
    { type: CipherType.Login, icon: "globe", label: "typeLogin" },
    { type: CipherType.Card, icon: "credit-card", label: "typeCard" },
    { type: CipherType.Identity, icon: "id-card", label: "typeIdentity" },
    { type: CipherType.SecureNote, icon: "sticky-note", label: "typeSecureNote" },
    { type: CipherType.SshKey, icon: "key", label: "typeSshKey" },
  ];

  constructor(
    public dialogRef: DialogRef,
    private router: Router,
    @Inject(DIALOG_DATA) public data: ImportSuccessDialogData,
  ) {}

  ngOnInit(): void {
    if (this.data.importResult != null || this.data.sdkSummary != null) {
      this.dataSource.data = this.buildResultList();
    }
  }

  protected navigateBack(): void {
    void this.dialogRef.close();
    if (this.data.returnUrl) {
      void this.router.navigateByUrl(this.data.returnUrl);
    }
  }

  private buildResultList(): ResultList[] {
    if (this.data.sdkSummary != null) {
      return this.buildResultListFromSummary(this.data.sdkSummary);
    }
    return this.buildResultListFromImportResult();
  }

  private buildResultListFromSummary(summary: SdkImportSummary): ResultList[] {
    const list: ResultList[] = [];
    for (const row of this.cipherTypeRows) {
      const count = summary.ciphers
        .filter((c) => c.type === row.type)
        .reduce((total, c) => total + c.count, 0);
      if (count > 0) {
        list.push({ icon: row.icon, type: row.label, count });
      }
    }
    if (summary.folders > 0) {
      list.push({ icon: "folder", type: "folders", count: summary.folders });
    }
    if (summary.collections > 0) {
      list.push({ icon: "collection", type: "collections", count: summary.collections });
    }
    return list;
  }

  private buildResultListFromImportResult(): ResultList[] {
    const importResult = this.data.importResult;
    if (importResult == null) {
      return [];
    }

    let logins = 0;
    let cards = 0;
    let identities = 0;
    let secureNotes = 0;
    let sshKeys = 0;
    importResult.ciphers.forEach((c) => {
      switch (c.type) {
        case CipherType.Login:
          logins++;
          break;
        case CipherType.Card:
          cards++;
          break;
        case CipherType.SecureNote:
          secureNotes++;
          break;
        case CipherType.Identity:
          identities++;
          break;
        case CipherType.SshKey:
          sshKeys++;
          break;
        default:
          break;
      }
    });

    const list: ResultList[] = [];
    if (logins > 0) {
      list.push({ icon: "globe", type: "typeLogin", count: logins });
    }
    if (cards > 0) {
      list.push({ icon: "credit-card", type: "typeCard", count: cards });
    }
    if (identities > 0) {
      list.push({ icon: "id-card", type: "typeIdentity", count: identities });
    }
    if (secureNotes > 0) {
      list.push({ icon: "sticky-note", type: "typeSecureNote", count: secureNotes });
    }
    if (sshKeys > 0) {
      list.push({ icon: "key", type: "typeSshKey", count: sshKeys });
    }
    if (importResult.folders.length > 0) {
      list.push({ icon: "folder", type: "folders", count: importResult.folders.length });
    }
    if (importResult.collections.length > 0) {
      list.push({
        icon: "collection",
        type: "collections",
        count: importResult.collections.length,
      });
    }
    return list;
  }
}
