import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { ImportMetadataServiceAbstraction } from "@bitwarden/importer-core";
import {
  ImportControlsComponent,
  ImporterProviders,
  importTypeFromRoute,
  SYSTEM_SERVICE_PROVIDER,
} from "@bitwarden/importer-ui";
import { safeProvider } from "@bitwarden/ui-common";

import { DesktopHeaderComponent } from "../../layout/header";

import { DesktopImportMetadataService } from "./desktop-import-metadata.service";

@Component({
  templateUrl: "import-controls-desktop.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportControlsComponent, DesktopHeaderComponent],
  providers: [
    ...ImporterProviders,
    safeProvider({
      provide: ImportMetadataServiceAbstraction,
      useClass: DesktopImportMetadataService,
      deps: [SYSTEM_SERVICE_PROVIDER],
    }),
  ],
})
export class ImportControlsDesktopComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly importType = importTypeFromRoute(this.route);

  protected onBack(): void {
    void this.router.navigate(["/import"]);
  }

  protected onContinue(): void {}
}
