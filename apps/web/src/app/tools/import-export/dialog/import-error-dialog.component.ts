import { DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, Inject, OnInit } from "@angular/core";

import { TableDataSource } from "@bitwarden/components";

export interface ErrorListItem {
  type: string;
  message: string;
}

@Component({
  selector: "app-import-error-dialog",
  templateUrl: "./import-error-dialog.component.html",
})
export class ImportErrorDialogComponent implements OnInit {
  protected dataSource = new TableDataSource<ErrorListItem>();

  constructor(public dialogRef: DialogRef, @Inject(DIALOG_DATA) public data: Error) {}

  ngOnInit(): void {
    const split = this.data.message.split("\n\n");
    if (split.length == 1) {
      this.dataSource.data = [{ type: "", message: this.data.message }];
      return;
    }

    const data: ErrorListItem[] = [];
    split.forEach((line) => {
      data.push({ type: "", message: line });
    });
    this.dataSource.data = data;
  }
}
