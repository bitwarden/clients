import { Component, inject, OnInit } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { getWebStoreUrl } from "@bitwarden/common/vault/utils/get-web-store-url";
import {
  ButtonComponent,
  DIALOG_DATA,
  DialogModule,
  TypographyModule,
} from "@bitwarden/components";

export type AddExtensionLaterDialogData = {
  /** Method invoked when the dialog is dismissed */
  onDismiss: () => void;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-add-extension-later-dialog",
  templateUrl: "./add-extension-later-dialog.component.html",
  imports: [DialogModule, JslibModule, TypographyModule, ButtonComponent, RouterModule],
})
export class AddExtensionLaterDialogComponent implements OnInit {
  private platformUtilsService = inject(PlatformUtilsService);
  private data: AddExtensionLaterDialogData = inject(DIALOG_DATA);

  /** Download Url for the extension based on the browser */
  protected webStoreUrl: string = "";

  ngOnInit(): void {
    this.webStoreUrl = getWebStoreUrl(this.platformUtilsService.getDevice());
  }

  async dismissExtensionPage() {
    this.data.onDismiss();
  }
}
