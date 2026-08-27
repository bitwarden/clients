import { ChangeDetectionStrategy, Component } from "@angular/core";

import { TypographyModule } from "@bitwarden/components";
import { ImportSourceSelectComponent } from "@bitwarden/importer-ui";
import { I18nPipe } from "@bitwarden/ui-common";

import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "import-source-select-browser.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportSourceSelectComponent, I18nPipe, PopupPageComponent, TypographyModule],
})
export class ImportSourceSelectBrowserComponent {}
