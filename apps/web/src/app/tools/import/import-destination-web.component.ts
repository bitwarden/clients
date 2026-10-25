import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { ImportStagingServiceAbstraction } from "@bitwarden/importer-core";
import {
  ImportDestinationComponent,
  ImportUpgradeProviders,
  importTypeFromRoute,
} from "@bitwarden/importer-ui";

@Component({
  templateUrl: "import-destination-web.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportDestinationComponent],
  providers: [...ImportUpgradeProviders],
})
export class ImportDestinationWebComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly importType = importTypeFromRoute(this.route);

  // A refresh or deep link lands here with nothing staged, so there is nothing to place.
  protected readonly hasStagedItems = inject(ImportStagingServiceAbstraction).current() != null;

  constructor() {
    if (!this.hasStagedItems) {
      void this.router.navigate(["/tools/import"]);
    }
  }

  // The start of credential parsing, not a page within it.
  protected onBack(): void {
    void this.router.navigate(["/tools/import", this.importType()]);
  }

  protected onContinue(): void {
    void this.router.navigate(["/vault"]);
  }
}
