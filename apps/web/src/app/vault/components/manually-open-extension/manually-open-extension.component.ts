import { Component, ChangeDetectionStrategy } from "@angular/core";

import { BitwardenIcon } from "@bitwarden/assets/svg";
import { SvgModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "vault-manually-open-extension",
  templateUrl: "./manually-open-extension.component.html",
  imports: [I18nPipe, SvgModule],
})
export class ManuallyOpenExtensionComponent {
  protected BitwardenIcon = BitwardenIcon;
}
