import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { BitwardenLogo } from "@bitwarden/assets/svg";
import { SvgModule, TypographyModule } from "@bitwarden/components";
import {
  DefaultImportMetadataService,
  ImportMetadataServiceAbstraction,
} from "@bitwarden/importer-core";
import {
  ImportControlsComponent,
  ImporterProviders,
  importTypeFromRoute,
  SYSTEM_SERVICE_PROVIDER,
} from "@bitwarden/importer-ui";
import { I18nPipe, safeProvider } from "@bitwarden/ui-common";

import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "import-controls-browser.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportControlsComponent, I18nPipe, PopupPageComponent, SvgModule, TypographyModule],
  providers: [
    ...ImporterProviders,
    safeProvider({
      provide: ImportMetadataServiceAbstraction,
      useClass: DefaultImportMetadataService,
      deps: [SYSTEM_SERVICE_PROVIDER],
    }),
  ],
})
export class ImportControlsBrowserComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly logo = BitwardenLogo;

  protected readonly importType = importTypeFromRoute(this.route);

  protected onBack(): void {
    void this.router.navigate(["/import-source-select"]);
  }

  protected onContinue(): void {}
}
