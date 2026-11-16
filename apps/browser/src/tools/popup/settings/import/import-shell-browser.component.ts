import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { CollectionService } from "@bitwarden/admin-console/common";
import { BitwardenLogo } from "@bitwarden/assets/svg";
import { SvgModule, TypographyModule } from "@bitwarden/components";
import { ImportShellProgressComponent, importShellProviders } from "@bitwarden/importer-ui";
import { I18nPipe } from "@bitwarden/ui-common";

import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "import-shell-browser.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PopupPageComponent,
    SvgModule,
    TypographyModule,
    I18nPipe,
    ImportShellProgressComponent,
    RouterOutlet,
  ],
  providers: importShellProviders(CollectionService),
})
export class ImportShellBrowserComponent {
  protected readonly logo = BitwardenLogo;
}
