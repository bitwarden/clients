import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import {
  DefaultImportUpgradeMetadataService,
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

import {
  IMPORT_CONFIRMATION_ROUTE_PATH,
  ImportConfirmationStateService,
} from "./import-confirmation-state.service";

@Component({
  templateUrl: "import-controls-browser.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportControlsComponent],
  providers: [
    ...ImportUpgradeProviders,
    safeProvider({
      provide: ImportUpgradeMetadataServiceAbstraction,
      useClass: DefaultImportUpgradeMetadataService,
      deps: [SYSTEM_SERVICE_PROVIDER],
    }),
  ],
})
export class ImportControlsBrowserComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly stagingService = inject(ImportStagingServiceAbstraction);
  private readonly confirmationState = inject(ImportConfirmationStateService);

  protected readonly importType = importTypeFromRoute(this.route);

  protected onBack(): void {
    void this.router.navigate(["/import-source-select"], {
      queryParams: { source: this.importType() },
    });
  }

  protected onContinue(): void {
    // Staged items mean the user still has to pick where they go.
    if (this.stagingService.current() != null) {
      void this.router.navigate([
        "/import-source-select",
        this.importType(),
        IMPORT_DESTINATION_SEGMENT,
      ]);
      return;
    }
    // A finished import left its result for the confirmation page, unless items were skipped.
    void this.router.navigate([
      this.confirmationState.current() != null
        ? `/${IMPORT_CONFIRMATION_ROUTE_PATH}`
        : "/tabs/vault",
    ]);
  }
}
