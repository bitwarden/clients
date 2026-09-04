import { ChangeDetectionStrategy, Component, output } from "@angular/core";

import { ReportBreach } from "@bitwarden/assets/svg";
import { ButtonModule, StatusLockupComponent, SvgComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Shown by a rotation tab when its list could not be fetched, in place of the tab's empty state.
 * Emits {@link retry}; the parent owns re-running whichever loads that tab needs.
 */
@Component({
  selector: "pam-rotation-load-error",
  templateUrl: "./rotation-load-error.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, StatusLockupComponent, SvgComponent, I18nPipe],
  host: {
    class: "tw-block",
    role: "alert",
  },
})
export class RotationLoadErrorComponent {
  readonly retry = output<void>();

  protected readonly icon = ReportBreach;
}
