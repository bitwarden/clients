import { Component, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  ButtonLinkDirective,
  ButtonModule,
  DialogModule,
  DialogService,
  DIALOG_DATA,
  DialogRef,
} from "@bitwarden/components";

export type AdvancedUriOptionDialogParams = {
  contentKey: string;
  onCancel: () => void;
  onContinue: () => void;
};

@Component({
  templateUrl: "advanced-uri-option-dialog.component.html",
  imports: [ButtonLinkDirective, ButtonModule, DialogModule, JslibModule],
})
export class AdvancedUriOptionDialogComponent {
  constructor(private dialogRef: DialogRef<boolean>) {}

  protected platformUtilsService = inject(PlatformUtilsService);
  protected params = inject<AdvancedUriOptionDialogParams>(DIALOG_DATA);

  get contentKey(): string {
    return this.params.contentKey;
  }

  onCancel() {
    this.params.onCancel?.();
    this.dialogRef.close(false);
  }

  onContinue() {
    this.params.onContinue?.();
    this.dialogRef.close(true);
  }

  openLink(event: Event) {
    event.preventDefault();
    this.platformUtilsService.launchUri("https://bitwarden.com/help/uri-match-detection/");
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
