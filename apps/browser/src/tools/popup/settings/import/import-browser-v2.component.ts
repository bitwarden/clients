import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AsyncActionsModule, ButtonModule, DialogModule } from "@bitwarden/components";
import {
  DefaultImportMetadataService,
  ImportMetadataServiceAbstraction,
} from "@bitwarden/importer-core";
import {
  ImportComponent,
  ImporterProviders,
  OnePasswordSsoBrowser,
  SYSTEM_SERVICE_PROVIDER,
} from "@bitwarden/importer-ui";
import { safeProvider } from "@bitwarden/ui-common";

import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";

import { BrowserOnePasswordSsoBrowser } from "./browser-onepassword-sso-browser";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "import-browser-v2.component.html",
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    AsyncActionsModule,
    ButtonModule,
    ImportComponent,
    PopupPageComponent,
    PopupFooterComponent,
    PopupHeaderComponent,
    PopOutComponent,
  ],
  providers: [
    ...ImporterProviders,
    safeProvider({
      provide: ImportMetadataServiceAbstraction,
      useClass: DefaultImportMetadataService,
      deps: [SYSTEM_SERVICE_PROVIDER],
    }),
    safeProvider({
      provide: OnePasswordSsoBrowser,
      useClass: BrowserOnePasswordSsoBrowser,
      deps: [],
    }),
  ],
})
export class ImportBrowserV2Component {
  protected disabled = false;
  protected loading = false;

  constructor(private router: Router) {}

  protected async onSuccessfulImport(organizationId: string): Promise<void> {
    await this.router.navigate(["/vault-settings"]);
  }
}
