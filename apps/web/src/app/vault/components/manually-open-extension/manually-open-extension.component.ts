import { Component } from "@angular/core";

import { BitwardenIcon } from "@bitwarden/assets/svg";
import { IconModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "vault-manually-open-extension",
  templateUrl: "./manually-open-extension.component.html",
  imports: [I18nPipe, IconModule],
})
export class ManuallyOpenExtensionComponent {
  protected BitwardenIcon = BitwardenIcon;
}
