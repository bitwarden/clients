import { CommonModule } from "@angular/common";
import { Component, Inject, OnInit } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  DialogRef,
  DIALOG_DATA,
  ButtonModule,
  DialogModule,
  TableDataSource,
  TableModule,
} from "@bitwarden/components";

import { ImportResult } from "../../models";

export interface ImportSuccessDialogData {
  importResult: ImportResult;
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
  imports: [CommonModule, JslibModule, DialogModule, TableModule, ButtonModule],
})
export class ImportSuccessDialogComponent implements OnInit {
  protected dataSource = new TableDataSource<ResultList>();

  protected get hasReturnDestination(): boolean {
    return !!this.data.returnUrl && !!this.data.returnLabel;
  }

  constructor(
    public dialogRef: DialogRef,
    private router: Router,
    @Inject(DIALOG_DATA) public data: ImportSuccessDialogData,
  ) {}

  ngOnInit(): void {
    if (this.data.importResult != null) {
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
    const resultCounts = new Map<CipherType, number>();
    this.data.importResult.ciphers.forEach((c) => {
      const curCount = resultCounts.get(c.type);
      if (curCount === undefined) {
        resultCounts.set(c.type, 1);
      } else {
        resultCounts.set(c.type, curCount + 1);
      }
    });

    const list: ResultList[] = Array.from(resultCounts.entries()).flatMap(([cipherType, count]) => {
      switch (cipherType) {
        case CipherType.Login:
          return { icon: "globe", type: "typeLogin", count };
        case CipherType.Card:
          return { icon: "credit-card", type: "typeCard", count };
        case CipherType.Identity:
          return { icon: "id-card", type: "typeIdentity", count };
        case CipherType.SecureNote:
          return { icon: "sticky-note", type: "typeSecureNote", count };
        case CipherType.SshKey:
          return { icon: "key", type: "typeSshKey", count };
        case CipherType.BankAccount:
          return { icon: "bank", type: "typeBankAccount", count };
        case CipherType.DriversLicense:
          return { icon: "id-card", type: "typeDriversLicense", count };
        case CipherType.Passport:
          return { icon: "passport", type: "typePassport", count };
        default:
          // Ignore any CipherType we don't know about yet. The flatMap will remove this
          return [] as ResultList[];
      }
    });
    if (this.data.importResult.folders.length > 0) {
      list.push({ icon: "folder", type: "folders", count: this.data.importResult.folders.length });
    }
    if (this.data.importResult.collections.length > 0) {
      list.push({
        icon: "collection",
        type: "collections",
        count: this.data.importResult.collections.length,
      });
    }
    return list;
  }
}
