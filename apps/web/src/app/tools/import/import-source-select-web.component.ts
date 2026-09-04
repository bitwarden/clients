import { ChangeDetectionStrategy, Component } from "@angular/core";

import { ImportSourceSelectComponent } from "@bitwarden/importer-ui";

import { HeaderModule } from "../../layouts/header/header.module";

@Component({
  templateUrl: "import-source-select-web.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImportSourceSelectComponent, HeaderModule],
})
export class ImportSourceSelectWebComponent {}
