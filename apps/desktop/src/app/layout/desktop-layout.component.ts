import { Component, inject } from "@angular/core";
import { RouterModule } from "@angular/router";

import { PasswordManagerLogo } from "@bitwarden/assets/svg";
import { DialogService, LayoutComponent, NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ExportDesktopComponent } from "../tools/export/export-desktop.component";
import { CredentialGeneratorComponent } from "../tools/generator/credential-generator.component";
import { ImportDesktopComponent } from "../tools/import/import-desktop.component";
import { SendFiltersNavComponent } from "../tools/send-v2/send-filters-nav.component";

import { DesktopSideNavComponent } from "./desktop-side-nav.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-layout",
  imports: [
    RouterModule,
    I18nPipe,
    LayoutComponent,
    NavigationModule,
    DesktopSideNavComponent,
    SendFiltersNavComponent,
  ],
  templateUrl: "./desktop-layout.component.html",
})
export class DesktopLayoutComponent {
  private dialogService = inject(DialogService);

  protected readonly logo = PasswordManagerLogo;

  protected openGenerator() {
    this.dialogService.open(CredentialGeneratorComponent);
  }

  protected openImport() {
    this.dialogService.open(ImportDesktopComponent);
  }

  protected openExport() {
    this.dialogService.open(ExportDesktopComponent);
  }
}
