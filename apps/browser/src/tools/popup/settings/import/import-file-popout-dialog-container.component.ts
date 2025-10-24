import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DialogService } from "@bitwarden/components";

import { FilePopoutUtilsService } from "../../services/file-popout-utils.service";

import { ImportFilePopoutDialogComponent } from "./import-file-popout-dialog.component";

@Component({
  selector: "import-file-popout-dialog-container",
  template: "",
  imports: [JslibModule, CommonModule],
})
export class ImportFilePopoutDialogContainerComponent implements OnInit {
  constructor(
    private dialogService: DialogService,
    private filePopoutUtilsService: FilePopoutUtilsService,
  ) {}

  ngOnInit() {
    if (this.filePopoutUtilsService.showFilePopoutMessage(window)) {
      this.dialogService.open(ImportFilePopoutDialogComponent);
    }
  }
}
