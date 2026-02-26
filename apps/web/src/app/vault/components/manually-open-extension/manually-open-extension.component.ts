// FIXME(https://bitwarden.atlassian.net/browse/CL-1062): `OnPush` components should not use mutable properties
/* eslint-disable @bitwarden/components/enforce-readonly-angular-properties */
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
