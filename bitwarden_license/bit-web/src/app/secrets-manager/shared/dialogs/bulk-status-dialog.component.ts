// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject, OnInit } from "@angular/core";

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
