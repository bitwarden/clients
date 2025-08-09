import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { ButtonModule, DialogModule, DialogRef, DIALOG_DATA } from "@bitwarden/components";

export interface DuplicateSuccessDialogData {
  trashed: number;
  permanentlyDeleted: number;
}

@Component({
  templateUrl: "./duplicate-success-dialog.component.html",
  imports: [CommonModule, DialogModule, ButtonModule],
})
export class DuplicateSuccessDialogComponent {
  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) public data: DuplicateSuccessDialogData,
  ) {}
}
