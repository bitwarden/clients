import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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

  protected readonly onLoadProfilesFromBrowser = this._onLoadProfilesFromBrowser.bind(this);
  protected readonly onImportFromBrowser = this._onImportFromBrowser.bind(this);

  constructor(
    public dialogRef: DialogRef,
    private i18nService: I18nService,
  ) {}

  /**
   * Callback that is called after a successful import.
   */
  protected async onSuccessfulImport(organizationId: string): Promise<void> {
    this.dialogRef.close();
  }

  private async _onLoadProfilesFromBrowser(
    browser: string,
  ): Promise<chromium_importer.ProfileInfo[]> {
    try {
      // Request browser access (required for sandboxed builds, no-op otherwise)
      await ipc.tools.chromiumImporter.requestBrowserAccess(browser);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "";

      // Check verbose error chain for specific i18n key indicating browser not installed
      const browserNotInstalledMatch = rawMessage.match(
        /chromiumImporterBrowserNotInstalled:([^:]+)/,
      );
      let message: string;

      if (browserNotInstalledMatch) {
        message = this.i18nService.t(
          "chromiumImporterBrowserNotInstalled",
          browserNotInstalledMatch[1],
        );
      } else {
        // Invalid folder, explicit permission denial, or system error
        message = this.i18nService.t("browserAccessDenied");
      }

      throw new Error(message);
    }
    return ipc.tools.chromiumImporter.getAvailableProfiles(browser);
  }

  private _onImportFromBrowser(
    browser: string,
    profile: string,
  ): Promise<chromium_importer.LoginImportResult[]> {
    return ipc.tools.chromiumImporter.importLogins(browser, profile);
  }
}
