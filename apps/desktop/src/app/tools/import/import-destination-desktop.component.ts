import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { ImportStagingServiceAbstraction } from "@bitwarden/importer-core";
import {
  ImportDestinationComponent,
  ImportUpgradeProviders,
  importScopeFromQuery,
  importTypeFromRoute,
  navigateCarryingImportParams,
} from "@bitwarden/importer-ui";
import { vaultCommandsAfterImport } from "@bitwarden/vault";

@Component({
  templateUrl: "import-destination-desktop.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportDestinationComponent],
  providers: [...ImportUpgradeProviders],
})
export class ImportDestinationDesktopComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly importType = importTypeFromRoute(this.route);

  // The vault the import was started from, so the location step can start on it.
  protected readonly scope = importScopeFromQuery(this.route);

  // A refresh or deep link lands here with nothing staged, so there is nothing to place.
  protected readonly hasStagedItems = inject(ImportStagingServiceAbstraction).current() != null;

  constructor() {
    if (!this.hasStagedItems) {
      void navigateCarryingImportParams(this.router, this.route, ["/import"]);
    }
  }

  // The start of credential parsing, not a page within it.
  protected onBack(): void {
    void navigateCarryingImportParams(this.router, this.route, ["/import", this.importType()]);
  }

  protected onContinue(): void {
    void this.router.navigate(vaultCommandsAfterImport(this.route));
  }
}
