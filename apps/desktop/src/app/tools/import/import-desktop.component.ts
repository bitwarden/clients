/* eslint-disable no-console */
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DialogRef, AsyncActionsModule, ButtonModule, DialogModule } from "@bitwarden/components";
import type { chromium_importer } from "@bitwarden/desktop-napi";
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

  // Bind callbacks in constructor to maintain reference equality
  protected readonly onLoadProfilesFromBrowser = this._onLoadProfilesFromBrowser.bind(this);
  protected readonly onImportFromBrowser = this._onImportFromBrowser.bind(this);

  constructor(public dialogRef: DialogRef) {}

  /**
   * Callback that is called after a successful import.
   */
  protected async onSuccessfulImport(organizationId: string): Promise<void> {
    this.dialogRef.close();
  }

  private async _onLoadProfilesFromBrowser(
    browser: string,
  ): Promise<chromium_importer.ProfileInfo[]> {
    console.log("[SANDBOX] onLoadProfilesFromBrowser called for:", browser);
    // Request browser access (required for sandboxed builds, no-op otherwise)
    try {
      console.log("[SANDBOX] Calling requestBrowserAccess...");
      await ipc.tools.chromiumImporter.requestBrowserAccess(browser);
      console.log("[SANDBOX] requestBrowserAccess completed successfully");
    } catch (error) {
      console.error("[SANDBOX] requestBrowserAccess failed:", error);
      throw error;
    }
    console.log("[SANDBOX] Calling getAvailableProfiles...");
    return ipc.tools.chromiumImporter.getAvailableProfiles(browser);
  }

  private _onImportFromBrowser(
    browser: string,
    profile: string,
  ): Promise<chromium_importer.LoginImportResult[]> {
    return ipc.tools.chromiumImporter.importLogins(browser, profile);
  }
}
