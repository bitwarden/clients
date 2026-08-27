import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { BadgeModule, NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { PamNavBadgeService } from "../pam-nav-badge.service";

/**
 * Renders the "My access" nav item in the individual user side nav when the
 * {@link FeatureFlag.Pam} feature flag is on and the user belongs to an organization that has
 * PAM enabled (`usePam`) — the "My access" page is empty for anyone else.
 *
 * Also badges the item with the number of the caller's own requests still awaiting their attention,
 * read through the optional {@link PamNavBadgeService} seam — unprovided in OSS-only builds, where the
 * count falls back to 0 and no badge renders.
 *
 * Encapsulates the flag lookup, the organization gate, and the badge lookup so the host layout can
 * plug PAM in with a single tag and no PAM-specific symbols.
 */
@Component({
  selector: "app-pam-user-nav-slot",
  templateUrl: "./pam-user-nav-slot.component.html",
  host: { class: "tw-contents" },
  imports: [BadgeModule, I18nPipe, NavigationModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PamUserNavSlotComponent {
  private readonly configService = inject(ConfigService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);

  private readonly pamEnabled$ = this.configService.getFeatureFlag$(FeatureFlag.Pam);
  private readonly memberOfPamOrg$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => this.organizationService.organizations$(userId)),
    map((organizations) => organizations.some((organization) => organization.usePam)),
  );

  protected readonly showPam = toSignal(
    combineLatest([this.pamEnabled$, this.memberOfPamOrg$]).pipe(
      map(([pamEnabled, memberOfPamOrg]) => pamEnabled && memberOfPamOrg),
    ),
    { initialValue: false },
  );

  protected readonly badgeCount = toSignal(
    inject(PamNavBadgeService, { optional: true })?.count$ ?? of(0),
    { initialValue: 0 },
  );
}
