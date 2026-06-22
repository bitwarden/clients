import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { of } from "rxjs";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { BadgeModule, NavigationModule } from "@bitwarden/components";
import { PamInboxBadgeService } from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Renders the PAM nav group (Access rules, Access requests, Governance) in the Admin Console
 * organization side nav, including the approver-inbox badge count, when the {@link FeatureFlag.Pam}
 * feature flag is on and the organization can manage access rules.
 *
 * Encapsulates the flag lookup, the access-rule gate, and the badge-count subscription so the host
 * layout can plug PAM in with a single tag and no PAM-specific symbols.
 */
@Component({
  selector: "app-pam-org-nav-slot",
  templateUrl: "./pam-org-nav-slot.component.html",
  imports: [AsyncPipe, BadgeModule, I18nPipe, NavigationModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PamOrgNavSlotComponent {
  readonly organization = input.required<Organization>();

  protected readonly pamEnabled$ = inject(ConfigService).getFeatureFlag$(FeatureFlag.Pam);
  protected readonly pamInboxBadgeCount = toSignal(
    inject(PamInboxBadgeService, { optional: true })?.count$ ?? of(0),
    { initialValue: 0 },
  );
}
