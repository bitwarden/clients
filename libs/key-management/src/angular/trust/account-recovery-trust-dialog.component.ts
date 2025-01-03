import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, Inject, OnInit } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, DialogModule, TableModule } from "@bitwarden/components";

export interface ErrorListItem {
  type: string;
  message: string;
}

@Component({
  templateUrl: "./account-recovery-trust-dialog.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule, DialogModule, TableModule, ButtonModule],
})
export class AccountRecoveryTrustDialogComponent implements OnInit {
  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) public data: Error,
  ) {}

  ngOnInit(): void {}
}
