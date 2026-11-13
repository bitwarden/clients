import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { CollectionService } from "@bitwarden/admin-console/common";
import { BitwardenLogo } from "@bitwarden/assets/svg";
import { SvgModule, TypographyModule } from "@bitwarden/components";
import {
  ImportOutcomePresenter,
  ImportShellProgressComponent,
  importShellProviders,
} from "@bitwarden/importer-ui";
import { I18nPipe, safeProvider } from "@bitwarden/ui-common";

import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";

import { BrowserImportOutcomePresenter } from "./browser-import-outcome-presenter";

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
  providers: [
    ...importShellProviders(CollectionService),
    // After the shell defaults, so it replaces the dialog presenter.
    safeProvider({
      provide: ImportOutcomePresenter,
      useClass: BrowserImportOutcomePresenter,
      deps: [],
    }),
  ],
})
export class ImportShellBrowserComponent {
  protected readonly logo = BitwardenLogo;
}
