import { Component } from "@angular/core";

import { DialogModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  imports: [DialogModule, I18nPipe],
  templateUrl: "vault-item-group-navigation-dialog.component.html",
})
export class VaultItemGroupNavigationDialogComponent {}
