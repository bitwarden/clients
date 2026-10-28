import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { ImportShellProgressComponent } from "@bitwarden/importer-ui";

import { HeaderModule } from "../../layouts/header/header.module";

@Component({
  templateUrl: "import-shell-web.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeaderModule, ImportShellProgressComponent, RouterOutlet],
})
export class ImportShellWebComponent {}
