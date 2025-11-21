import { CommonModule } from "@angular/common";
import { Component, OnInit, ChangeDetectionStrategy, OnDestroy } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DialogRef, DialogService } from "@bitwarden/components";

import { FilePopoutUtilsService } from "../../services/file-popout-utils.service";

import { ImportFilePopoutDialogComponent } from "./import-file-popout-dialog.component";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "import-file-popout-dialog-container",
  template: "",
  imports: [JslibModule, CommonModule],
})
export class ImportFilePopoutDialogContainerComponent implements OnInit, OnDestroy {
  private dialogRef?: DialogRef;

  constructor(
    private dialogService: DialogService,
    private filePopoutUtilsService: FilePopoutUtilsService,
  ) {}

  ngOnInit() {
    if (this.filePopoutUtilsService.showFilePopoutMessage(window)) {
      this.dialogRef = this.dialogService.open(ImportFilePopoutDialogComponent);
    }
  }

  ngOnDestroy() {
    this.dialogRef?.close();
  }
}
