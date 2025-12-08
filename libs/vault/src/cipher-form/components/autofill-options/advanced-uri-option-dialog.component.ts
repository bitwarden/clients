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
  CenterPositionStrategy,
} from "@bitwarden/components";

export type AdvancedUriOptionDialogParams = {
  contentKey: string;
  onCancel: () => void;
  onContinue: () => void;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}
