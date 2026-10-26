import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { ImportShellProgressComponent } from "@bitwarden/importer-ui";

import { DesktopHeaderComponent } from "../../layout/header";

@Component({
  templateUrl: "import-shell-desktop.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DesktopHeaderComponent, ImportShellProgressComponent, RouterOutlet],
})
export class ImportShellDesktopComponent {}
