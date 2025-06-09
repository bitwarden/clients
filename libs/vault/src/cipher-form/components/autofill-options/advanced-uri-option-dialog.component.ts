import { Component, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonModule,
  DialogModule,
  DialogService,
  AnchorLinkDirective,
  DIALOG_DATA,
  DialogRef,
} from "@bitwarden/components";

export type AdvancedUriOptionDialogParams = {
  contentKey: string;
};

@Component({
  templateUrl: "advanced-uri-option-dialog.component.html",
  imports: [JslibModule, ButtonModule, DialogModule, AnchorLinkDirective],
})
export class AdvancedUriOptionDialogComponent {
  constructor(private dialogRef: DialogRef<boolean>) {}

  protected platformUtilsService = inject(PlatformUtilsService);
  protected params = inject<AdvancedUriOptionDialogParams>(DIALOG_DATA);

  get contentKey(): string {
    return this.params.contentKey;
  }

  cancelClick() {
    this.dialogRef.close(false);
  }

  continueClick() {
    this.dialogRef.close(true);
  }

  static open(
    dialogService: DialogService,
    params: AdvancedUriOptionDialogParams,
  ): DialogRef<boolean> {
    return dialogService.open<boolean>(AdvancedUriOptionDialogComponent, {
      data: params,
      disableClose: true,
    });
  }
}
