import { Component } from "@angular/core";

import { IconModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { VaultIcons } from "@bitwarden/vault";

@Component({
  selector: "vault-manually-open-extension",
  templateUrl: "./manually-open-extension.component.html",
  imports: [I18nPipe, IconModule],
})
export class ManuallyOpenExtensionComponent {
  protected BitwardenIcon = VaultIcons.BitwardenIcon;
}
