import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Renders the PAM nav group (Access rules) in the Admin Console organization side nav when the
 * {@link FeatureFlag.Pam} feature flag is on and the organization can manage access rules.
 *
 * Encapsulates the flag lookup and the access-rule gate so the host layout can plug PAM in with a
 * single tag and no PAM-specific symbols.
 */
@Component({
  selector: "app-pam-org-nav-slot",
  templateUrl: "./pam-org-nav-slot.component.html",
  imports: [I18nPipe, NavigationModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PamOrgNavSlotComponent {
  private readonly configService = inject(ConfigService);

  /**
   * The organization the user is currently viewing.
   */
  readonly organization = input.required<Organization>();

  private readonly pamEnabled = toSignal(this.configService.getFeatureFlag$(FeatureFlag.Pam), {
    initialValue: false,
  });
  protected readonly showPam = computed(
    () => this.pamEnabled() && this.organization().canManageAccessRules,
  );
}
