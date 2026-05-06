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
    let logins = 0;
    let cards = 0;
    let identities = 0;
    let secureNotes = 0;
    let sshKeys = 0;
    this.data.importResult.ciphers.forEach((c) => {
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
