import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { UpgradeImportType } from "@bitwarden/importer-core";
import {
  ImportSourceSelectComponent,
  importSourceFromQuery,
  navigateCarryingImportParams,
} from "@bitwarden/importer-ui";

@Component({
  templateUrl: "import-source-select-desktop.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportSourceSelectComponent],
})
export class ImportSourceSelectDesktopComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly initialSource = importSourceFromQuery(this.route);

  protected onContinue(importType: UpgradeImportType): void {
    void navigateCarryingImportParams(this.router, this.route, ["/import", importType]);
  }
}
