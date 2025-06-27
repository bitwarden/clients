import { Component, inject, OnInit } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { getWebStoreUrl } from "@bitwarden/common/vault/utils/get-web-store-url";
import { ButtonComponent, DialogModule, TypographyModule } from "@bitwarden/components";

@Component({
  selector: "vault-add-extension-later-dialog",
  templateUrl: "./add-extension-later-dialog.component.html",
  imports: [DialogModule, JslibModule, TypographyModule, ButtonComponent, RouterModule],
})
export class AddExtensionLaterDialogComponent implements OnInit {
  private platformUtilsService = inject(PlatformUtilsService);

  /** Download Url for the extension based on the browser */
  protected webStoreUrl: string = "";

  ngOnInit(): void {
    this.webStoreUrl = getWebStoreUrl(this.platformUtilsService.getDevice());
  }
}
