import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import { BitwardenLogo, BitwardenLogoBeta } from "@bitwarden/assets/svg";
import { BitIconButtonComponent, SvgComponent, TypographyModule } from "@bitwarden/components";
import { isBetaChannel } from "@bitwarden/release-channel";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Draggable header for the passkey modal window. Mirrors the browser extension's `popup-header`.
 */
@Component({
  selector: "app-fido2-modal-header",
  templateUrl: "fido2-modal-header.component.html",
  imports: [BitIconButtonComponent, I18nPipe, SvgComponent, TypographyModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Fido2ModalHeaderComponent {
  readonly pageTitle = input.required<string>();
  readonly closeModal = output<void>();

  protected readonly logo = isBetaChannel() ? BitwardenLogoBeta : BitwardenLogo;
}
