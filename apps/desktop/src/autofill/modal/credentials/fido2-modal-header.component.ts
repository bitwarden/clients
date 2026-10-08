import { ChangeDetectionStrategy, Component, inject, input, output } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { BitwardenLogo, BitwardenLogoBeta } from "@bitwarden/assets/svg";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { flagEnabled } from "@bitwarden/common/platform/misc/flags";
import {
  BitIconButtonComponent,
  SectionComponent,
  SectionHeaderComponent,
  SvgComponent,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Draggable header for the passkey modal window. Mirrors the browser extension's `popup-header`.
 */
@Component({
  selector: "app-fido2-modal-header",
  templateUrl: "fido2-modal-header.component.html",
  imports: [
    BitIconButtonComponent,
    I18nPipe,
    SectionComponent,
    SectionHeaderComponent,
    SvgComponent,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Fido2ModalHeaderComponent {
  readonly pageTitle = input.required<string>();
  readonly closeModal = output<void>();

  /** TODO: remove with the VFO1Foundation flag. Renders the two-bar header. */
  protected readonly vfo1Enabled = toSignal(
    inject(ConfigService).getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  protected readonly logo = flagEnabled("prereleaseBuild") ? BitwardenLogoBeta : BitwardenLogo;
}
