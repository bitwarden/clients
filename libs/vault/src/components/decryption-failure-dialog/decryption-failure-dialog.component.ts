import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherId } from "@bitwarden/common/types/guid";
import {
  DIALOG_DATA,
  DialogRef,
  AnchorLinkDirective,
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogService,
  TypographyModule,
} from "@bitwarden/components";

export type DecryptionFailureDialogParams = {
  cipherIds: CipherId[];
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-decryption-failure-dialog",
  templateUrl: "./decryption-failure-dialog.component.html",
  imports: [
    DialogModule,
    CommonModule,
    TypographyModule,
    JslibModule,
    AsyncActionsModule,
    ButtonModule,
    AnchorLinkDirective,
  ],
})
export class DecryptionFailureDialogComponent {
  protected dialogRef = inject(DialogRef);
  protected params = inject<DecryptionFailureDialogParams>(DIALOG_DATA);
  protected platformUtilsService = inject(PlatformUtilsService);

  selectText(element: HTMLElement) {
    const selection = window.getSelection();
    if (selection == null) {
      return;
    }
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.addRange(range);
  }

  openContactSupport(event: Event) {
    event.preventDefault();
    this.platformUtilsService.launchUri("https://bitwarden.com/contact");
  }

  static open(dialogService: DialogService, params: DecryptionFailureDialogParams) {
    return dialogService.open(DecryptionFailureDialogComponent, { data: params });
  }
}
