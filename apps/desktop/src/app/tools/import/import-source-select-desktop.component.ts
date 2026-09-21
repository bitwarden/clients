import { ChangeDetectionStrategy, Component } from "@angular/core";

import { ImportSourceSelectComponent } from "@bitwarden/importer-ui";

import { DesktopHeaderComponent } from "../../layout/header";

@Component({
  templateUrl: "import-source-select-desktop.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DesktopHeaderComponent, ImportSourceSelectComponent],
})
export class ImportSourceSelectDesktopComponent {}
