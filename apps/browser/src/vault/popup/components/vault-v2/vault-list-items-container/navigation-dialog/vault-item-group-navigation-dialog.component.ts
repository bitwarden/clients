import { Component } from "@angular/core";

import { ButtonModule, DialogModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  imports: [DialogModule, ButtonModule, TypographyModule, I18nPipe],
  templateUrl: "vault-item-group-navigation-dialog.component.html",
})
export class VaultItemGroupNavigationDialogComponent {}
