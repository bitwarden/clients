import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { ImportStagingServiceAbstraction } from "@bitwarden/importer-core";
import {
  ImportDestinationComponent,
  ImportUpgradeProviders,
  importTypeFromRoute,
} from "@bitwarden/importer-ui";

import {
  IMPORT_CONFIRMATION_ROUTE_PATH,
  ImportConfirmationStateService,
} from "./import-confirmation-state.service";

@Component({
  templateUrl: "import-destination-browser.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportDestinationComponent],
  providers: [...ImportUpgradeProviders],
})
export class ImportDestinationBrowserComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmationState = inject(ImportConfirmationStateService);

  protected readonly importType = importTypeFromRoute(this.route);

  // A refresh or deep link lands here with nothing staged, so there is nothing to place.
  protected readonly hasStagedItems = inject(ImportStagingServiceAbstraction).current() != null;

  constructor() {
    if (!this.hasStagedItems) {
      void this.router.navigate(["/import-source-select"]);
    }
  }

  // The start of credential parsing, not a page within it.
  protected onBack(): void {
    void this.router.navigate(["/import-source-select", this.importType()]);
  }

  protected onContinue(): void {
    // A finished import left its result for the confirmation page, unless items were skipped.
    void this.router.navigate([
      this.confirmationState.current() != null
        ? `/${IMPORT_CONFIRMATION_ROUTE_PATH}`
        : "/tabs/vault",
    ]);
  }
}
