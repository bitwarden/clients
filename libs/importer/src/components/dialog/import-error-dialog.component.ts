import { CommonModule } from "@angular/common";
import { Component, Inject, OnInit } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  DialogRef,
  DIALOG_DATA,
  ButtonModule,
  DialogModule,
  TableDataSource,
  TableModule,
} from "@bitwarden/components";

export interface ErrorListItem {
  type: string;
  message: string;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./import-error-dialog.component.html",
  imports: [CommonModule, JslibModule, DialogModule, TableModule, ButtonModule],
})
export class ImportErrorDialogComponent implements OnInit {
  protected dataSource = new TableDataSource<ErrorListItem>();

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) public data: Error,
  ) {}

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
