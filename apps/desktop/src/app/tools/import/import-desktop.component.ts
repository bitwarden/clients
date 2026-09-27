import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogModule,
} from "@bitwarden/components";
import type { chromium_importer } from "@bitwarden/desktop-napi";
import { ImportMetadataServiceAbstraction } from "@bitwarden/importer-core";
import {
  ImportComponent,
  ImporterProviders,
  SYSTEM_SERVICE_PROVIDER,
} from "@bitwarden/importer-ui";
import { I18nPipe, safeProvider } from "@bitwarden/ui-common";

import { loadChromiumProfiles } from "./chromium-profile-loader";
import { DesktopImportMetadataService } from "./desktop-import-metadata.service";

interface ImportDesktopDialogData {
  /** Pre-selects an organization in the import form */
  defaultOrganizationId?: string;
  /** Pre-selects a collection in the import form; only applied when defaultOrganizationId is also set */
  defaultCollectionId?: string;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "import-desktop.component.html",
  imports: [
    CommonModule,
    I18nPipe,
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
      deps: [SYSTEM_SERVICE_PROVIDER, I18nService],
    }),
  ],
})
export class ImportDesktopComponent {
  protected disabled = false;
  protected loading = false;
  protected readonly data = inject<ImportDesktopDialogData>(DIALOG_DATA, { optional: true });

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
    await this.dialogRef.close();
  }

  private async _onLoadProfilesFromBrowser(
    browser: string,
  ): Promise<chromium_importer.ProfileInfo[]> {
    return loadChromiumProfiles(browser, this.i18nService);
  }

  private async _onImportFromBrowser(
    browser: string,
    profile: string,
  ): Promise<chromium_importer.LoginImportResult[]> {
    try {
      return await ipc.tools.chromiumImporter.importLogins(browser, profile);
    } catch {
      throw new Error(this.i18nService.t("errorOccurred"));
    }
  }
}
