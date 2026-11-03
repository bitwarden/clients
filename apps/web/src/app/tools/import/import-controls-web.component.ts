import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

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

import { ImportRouteContext } from "./import-route-context";

@Component({
  templateUrl: "import-controls-web.component.html",
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
export class ImportControlsWebComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly stagingService = inject(ImportStagingServiceAbstraction);
  private readonly routeContext = inject(ImportRouteContext);

  protected readonly importType = importTypeFromRoute(this.route);
  private readonly organizationId = this.routeContext.organizationId(this.route);
  private readonly basePath = this.routeContext.basePath(this.organizationId);

  protected onBack(): void {
    void this.routeContext.navigate(this.route, this.basePath, {
      queryParams: { source: this.importType() },
    });
  }

  protected onContinue(): void {
    // Staged items mean the user still has to pick where they go.
    if (this.stagingService.current() != null) {
      void this.routeContext.navigate(this.route, [
        ...this.basePath,
        this.importType(),
        IMPORT_DESTINATION_SEGMENT,
      ]);
      return;
    }
    void this.routeContext.viewImportedItems(this.organizationId, this.route);
  }
}
