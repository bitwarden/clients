import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * PAM nav group in the Admin Console organization side nav. Each item mirrors its route's guard,
 * so the group never renders an item that would redirect.
 */
@Component({
  selector: "app-pam-org-nav-slot",
  templateUrl: "./pam-org-nav-slot.component.html",
  host: { class: "tw-contents" },
  imports: [I18nPipe, NavigationModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PamOrgNavSlotComponent {
  private readonly configService = inject(ConfigService);

  readonly organization = input.required<Organization>();

  private readonly pamEnabled = toSignal(this.configService.getFeatureFlag$(FeatureFlag.Pam), {
    initialValue: false,
  });
  private readonly rotationEnabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PamAccessConnector),
    { initialValue: false },
  );
  protected readonly showAccessRules = computed(
    () => this.pamEnabled() && this.organization().canManageAccessRules,
  );
  protected readonly showAuditLog = computed(
    () => this.pamEnabled() && this.organization().usePam && this.organization().canAccessEventLogs,
  );
  protected readonly showRotation = computed(
    () => this.pamEnabled() && this.rotationEnabled() && this.organization().canManageRotation,
  );
  protected readonly showPam = computed(
    () => this.showAccessRules() || this.showAuditLog() || this.showRotation(),
  );
}
