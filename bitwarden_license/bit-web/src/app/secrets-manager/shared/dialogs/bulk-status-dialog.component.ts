// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, OnInit } from "@angular/core";

import { DialogRef, DIALOG_DATA } from "@bitwarden/components";

export interface BulkStatusDetails {
  title: string;
  subTitle: string;
  columnTitle: string;
  message: string;
  details: BulkOperationStatus[];
}

export class BulkOperationStatus {
  id: string;
  name: string;
  errorMessage?: string;
}

@Component({
  templateUrl: "./bulk-status-dialog.component.html",
  standalone: false,
})
export class BulkStatusDialogComponent implements OnInit {
  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) public data: BulkStatusDetails,
  ) {}

  ngOnInit(): void {
    // TODO remove null checks once strictNullChecks in TypeScript is turned on.
    if (
      !this.data.title ||
      !this.data.subTitle ||
      !this.data.columnTitle ||
      !this.data.message ||
      !(this.data.details?.length >= 1)
    ) {
      this.dialogRef.close();
      throw new Error(
        "The bulk status dialog was not called with the appropriate operation values.",
      );
    }
  }
}
