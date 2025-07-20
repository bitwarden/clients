import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AsyncActionsModule, ButtonModule, DialogModule } from "@bitwarden/components";
import { ImportComponent } from "@bitwarden/importer-ui";

import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupFooterComponent } from "../../../../platform/popup/layout/popup-footer.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";

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
})
export class ImportBrowserV2Component {
  protected disabled = false;
  protected loading = false;

  constructor(private router: Router) {}

  protected async onSuccessfulImport(organizationId: string): Promise<void> {
    await this.router.navigate(["/vault-settings"]);
  }
}
