import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherDecryptionFailure } from "@bitwarden/common/vault/models/cipher-decryption-failure";
import {
  AsyncActionsModule,
  ButtonModule,
  CenterPositionStrategy,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  LinkComponent,
  TypographyModule,
} from "@bitwarden/components";

export type CipherSaveBlockedDialogParams = {
  /** Per-field decryption failures for the cipher the user attempted to save. */
  failures: CipherDecryptionFailure[];
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-cipher-save-blocked-dialog",
  templateUrl: "./cipher-save-blocked-dialog.component.html",
  imports: [
    DialogModule,
    CommonModule,
    TypographyModule,
    JslibModule,
    AsyncActionsModule,
    ButtonModule,
    LinkComponent,
  ],
})
export class CipherSaveBlockedDialogComponent {
  protected dialogRef = inject(DialogRef);
  protected params = inject<CipherSaveBlockedDialogParams>(DIALOG_DATA);
  protected platformUtilsService = inject(PlatformUtilsService);

  openContactSupport(event: Event) {
    event.preventDefault();
    this.platformUtilsService.launchUri("https://bitwarden.com/contact");
  }

  static open(dialogService: DialogService, params: CipherSaveBlockedDialogParams) {
    return dialogService.open(CipherSaveBlockedDialogComponent, {
      data: params,
      positionStrategy: new CenterPositionStrategy(),
    });
  }
}
