import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { Router } from "@angular/router";

import { BitwardenLogo } from "@bitwarden/assets/svg";
import { SvgModule, TypographyModule } from "@bitwarden/components";
import { ImportType } from "@bitwarden/importer-core";
import { ImportSourceSelectComponent } from "@bitwarden/importer-ui";
import { I18nPipe } from "@bitwarden/ui-common";

import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "import-source-select-browser.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportSourceSelectComponent, I18nPipe, PopupPageComponent, SvgModule, TypographyModule],
})
export class ImportSourceSelectBrowserComponent {
  private readonly router = inject(Router);

  protected readonly logo = BitwardenLogo;

  protected onContinue(importType: ImportType): void {
    void this.router.navigate(["/import", importType]);
  }
}
