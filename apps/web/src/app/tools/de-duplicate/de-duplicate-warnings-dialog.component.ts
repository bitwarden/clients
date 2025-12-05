import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonModule,
  DialogModule,
  DialogRef,
  DIALOG_DATA,
  DialogService,
} from "@bitwarden/components";

@Component({
  selector: "app-de-duplicate-warnings-dialog",
  standalone: true,
  imports: [CommonModule, DialogModule, ButtonModule],
  templateUrl: "./de-duplicate-warnings-dialog.component.html",
})
export class DeDuplicateWarningsDialogComponent {
  okText: string;

  constructor(
    public dialogRef: DialogRef<boolean>,
    @Inject(DIALOG_DATA)
    public data: { title: string; sections: { title: string; items: string[]; help?: string }[] },
    private i18nService: I18nService,
  ) {
    this.okText = this.i18nService.t("ok");
  }

  static open(
    dialogService: DialogService,
    data: { title: string; sections: { title: string; items: string[]; help?: string }[] },
  ) {
    return dialogService.open<boolean, typeof data>(DeDuplicateWarningsDialogComponent, { data });
  }
}
