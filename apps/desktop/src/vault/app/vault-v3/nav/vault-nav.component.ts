import { ChangeDetectionStrategy, Component } from "@angular/core";

import { NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "app-vault-nav",
  imports: [I18nPipe, NavigationModule],
  templateUrl: "./vault-nav.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VaultNavComponent {}
