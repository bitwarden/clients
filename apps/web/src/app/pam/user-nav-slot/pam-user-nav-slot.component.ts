import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Renders the "My access" nav item in the individual user side nav when the
 * {@link FeatureFlag.Pam} feature flag is on.
 *
 * Encapsulates the flag lookup so the host layout can plug PAM in with a single tag and no
 * PAM-specific symbols.
 */
@Component({
  selector: "app-pam-user-nav-slot",
  templateUrl: "./pam-user-nav-slot.component.html",
  imports: [I18nPipe, NavigationModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PamUserNavSlotComponent {
  private readonly configService = inject(ConfigService);

  protected readonly showPam = toSignal(this.configService.getFeatureFlag$(FeatureFlag.Pam), {
    initialValue: false,
  });
}
