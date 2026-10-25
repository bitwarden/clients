import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ImportStagingServiceAbstraction,
  ImportUpgradeMetadataServiceAbstraction,
} from "@bitwarden/importer-core";
import {
  IMPORT_DESTINATION_SEGMENT,
  ImportControlsComponent,
  ImportUpgradeProviders,
  importTypeFromRoute,
  SYSTEM_SERVICE_PROVIDER,
} from "@bitwarden/importer-ui";
import { safeProvider } from "@bitwarden/ui-common";

import { DesktopImportUpgradeMetadataService } from "./desktop-import-upgrade-metadata.service";

@Component({
  templateUrl: "import-controls-desktop.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportControlsComponent],
  providers: [
    ...ImportUpgradeProviders,
    safeProvider({
      provide: ImportUpgradeMetadataServiceAbstraction,
      useClass: DesktopImportUpgradeMetadataService,
      deps: [SYSTEM_SERVICE_PROVIDER, I18nService],
    }),
  ],
})
export class ImportControlsDesktopComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly stagingService = inject(ImportStagingServiceAbstraction);

  protected readonly importType = importTypeFromRoute(this.route);

  protected onBack(): void {
    void this.router.navigate(["/import"], { queryParams: { source: this.importType() } });
  }

  protected onContinue(): void {
    // Staged items mean the user still has to pick where they go.
    if (this.stagingService.current() != null) {
      void this.router.navigate(["/import", this.importType(), IMPORT_DESTINATION_SEGMENT]);
      return;
    }
    void this.router.navigate(["/vault"]);
  }
}
