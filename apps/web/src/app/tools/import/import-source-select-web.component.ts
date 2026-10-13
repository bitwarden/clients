import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { UpgradeImportType } from "@bitwarden/importer-core";
import { ImportSourceSelectComponent, importSourceFromQuery } from "@bitwarden/importer-ui";

@Component({
  templateUrl: "import-source-select-web.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportSourceSelectComponent],
})
export class ImportSourceSelectWebComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly initialSource = importSourceFromQuery(this.route);

  protected onContinue(importType: UpgradeImportType): void {
    void this.router.navigate(["/tools/import", importType]);
  }
}
