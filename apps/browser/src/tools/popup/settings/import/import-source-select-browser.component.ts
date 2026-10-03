import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";

import { ImportType } from "@bitwarden/importer-core";
import { ImportSourceSelectComponent } from "@bitwarden/importer-ui";

@Component({
  templateUrl: "import-source-select-browser.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportSourceSelectComponent],
})
export class ImportSourceSelectBrowserComponent {
  private readonly router = inject(Router);

  protected onContinue(importType: ImportType): void {
    // Not "/import" — that path is the legacy popup entry point (ImportBrowserV2Component),
    // guarded to redirect out to this full-tab flow instead.
    void this.router.navigate(["/import-source-select", importType]);
  }
}
