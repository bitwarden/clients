import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DialogRef, AsyncActionsModule, ButtonModule, DialogModule } from "@bitwarden/components";
import { ImportMetadataServiceAbstraction } from "@bitwarden/importer-core";
import {
  ImportComponent,
  ImporterProviders,
  SYSTEM_SERVICE_PROVIDER,
} from "@bitwarden/importer-ui";
import { safeProvider } from "@bitwarden/ui-common";

import { DesktopImportMetadataService } from "./desktop-import-metadata.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "import-desktop.component.html",
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    AsyncActionsModule,
    ButtonModule,
    ImportComponent,
  ],
  providers: [
    ...ImporterProviders,
    safeProvider({
      provide: ImportMetadataServiceAbstraction,
      useClass: DesktopImportMetadataService,
      deps: [SYSTEM_SERVICE_PROVIDER],
    }),
  ],
})
export class ImportDesktopComponent {
  protected disabled = false;
  protected loading = false;

  constructor(public dialogRef: DialogRef) {}

  /**
   * Callback that is called after a successful import.
   */
  protected async onSuccessfulImport(organizationId: string): Promise<void> {
    this.dialogRef.close();
  }

  protected onLoadProfilesFromBrowser(browser: string): Promise<any[]> {
    return ipc.tools.chromiumImporter.getAvailableProfiles(browser);
  }

  protected onImportFromBrowser(browser: string, profile: string): Promise<any[]> {
    return ipc.tools.chromiumImporter.importLogins(browser, profile);
  }
}
