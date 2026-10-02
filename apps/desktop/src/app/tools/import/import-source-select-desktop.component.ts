import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";

import { ImportType } from "@bitwarden/importer-core";
import { ImportSourceSelectComponent } from "@bitwarden/importer-ui";

@Component({
  templateUrl: "import-source-select-desktop.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportSourceSelectComponent],
})
export class ImportSourceSelectDesktopComponent {
  private readonly router = inject(Router);

  protected onContinue(importType: ImportType): void {
    void this.router.navigate(["/import", importType]);
  }
}
