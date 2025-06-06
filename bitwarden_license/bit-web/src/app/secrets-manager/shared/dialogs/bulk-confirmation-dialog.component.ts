import { Component, Inject, OnInit } from "@angular/core";

import { DialogRef, DIALOG_DATA } from "@bitwarden/components";

export interface BulkConfirmationDetails {
  title: string;
  columnTitle: string;
  message: string;
  details: BulkConfirmationStatus[];
}

export interface BulkConfirmationStatus {
  id: string;
  name: string;
  description: string;
}

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum BulkConfirmationResult {
  Continue,
  Cancel,
}

@Component({
  selector: "sm-bulk-confirmation-dialog",
  templateUrl: "./bulk-confirmation-dialog.component.html",
  standalone: false,
})
export class BulkConfirmationDialogComponent implements OnInit {
  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) public data: BulkConfirmationDetails,
  ) {}

  protected bulkConfirmationResult = BulkConfirmationResult;

  ngOnInit(): void {
    // TODO remove null checks once strictNullChecks in TypeScript is turned on.
    if (
      !this.data.title ||
      !this.data.columnTitle ||
      !this.data.message ||
      !(this.data.details?.length >= 1)
    ) {
      this.dialogRef.close();
      throw new Error(
        "The bulk confirmation dialog was not called with the appropriate operation values.",
      );
    }
  }
}
