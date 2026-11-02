import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import {
  DefaultImportUpgradeMetadataService,
  ImportUpgradeMetadataServiceAbstraction,
} from "@bitwarden/importer-core";
import {
  ImportControlsComponent,
  ImportUpgradeProviders,
  importTypeFromRoute,
  SYSTEM_SERVICE_PROVIDER,
} from "@bitwarden/importer-ui";
import { safeProvider } from "@bitwarden/ui-common";

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
  private readonly router = inject(Router);

  protected readonly importType = importTypeFromRoute(this.route);

  protected onBack(): void {
    void this.router.navigate(["/tools/import"], { queryParams: { source: this.importType() } });
  }

  protected onContinue(): void {
    void this.router.navigate(["/vault"]);
  }
}
