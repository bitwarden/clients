import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { ImportStagingServiceAbstraction } from "@bitwarden/importer-core";
import {
  ImportDestinationComponent,
  ImportUpgradeProviders,
  importTypeFromRoute,
} from "@bitwarden/importer-ui";

import { ImportRouteContext } from "./import-route-context";

@Component({
  templateUrl: "import-destination-web.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportDestinationComponent],
  providers: [...ImportUpgradeProviders],
})
export class ImportDestinationWebComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly routeContext = inject(ImportRouteContext);

  protected readonly importType = importTypeFromRoute(this.route);
  private readonly organizationId = this.routeContext.organizationId(this.route);
  private readonly basePath = this.routeContext.basePath(this.organizationId);
  protected readonly returnTo = this.routeContext.returnTo(this.route);
  protected readonly scope = this.routeContext.scope(this.route);

  // A refresh or deep link lands here with nothing staged, so there is nothing to place.
  protected readonly hasStagedItems = inject(ImportStagingServiceAbstraction).current() != null;

  constructor() {
    if (!this.hasStagedItems) {
      void this.routeContext.navigate(this.route, this.basePath);
    }
  }

  // The start of credential parsing, not a page within it.
  protected onBack(): void {
    void this.routeContext.navigate(this.route, [...this.basePath, this.importType()]);
  }

  protected onContinue(): void {
    void this.routeContext.viewImportedItems(this.organizationId, this.route);
  }
}
