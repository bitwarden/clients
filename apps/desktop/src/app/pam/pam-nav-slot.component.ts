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

import { PamNavBadgeService } from "./pam-nav-badge.service";
import { PAM_DESKTOP_ROUTES } from "./pam-routes.token";

/**
 * "Access requests" item in the VFO1 manage nav section, badged with the pending count. Renders
 * only when the build provides `PAM_DESKTOP_ROUTES`, the PAM flag is on, and some organization of
 * the user uses PAM. An OSS build leaves the token unprovided, so the item never leads nowhere.
 */
@Component({
  selector: "app-pam-nav-slot",
  templateUrl: "./pam-nav-slot.component.html",
  host: { class: "tw-contents" },
  imports: [BadgeModule, I18nPipe, NavigationModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PamNavSlotComponent {
  private readonly configService = inject(ConfigService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);

  private readonly hasRoutes = inject(PAM_DESKTOP_ROUTES, { optional: true }) != null;

  private readonly pamEnabled$ = this.configService.getFeatureFlag$(FeatureFlag.Pam);
  private readonly memberOfPamOrg$ = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => this.organizationService.organizations$(userId)),
    map((organizations) => organizations.some((organization) => organization.usePam)),
  );

  protected readonly showPam = toSignal(
    combineLatest([this.pamEnabled$, this.memberOfPamOrg$]).pipe(
      map(([pamEnabled, memberOfPamOrg]) => this.hasRoutes && pamEnabled && memberOfPamOrg),
    ),
    { initialValue: false },
  );

  protected readonly badgeCount = toSignal(
    inject(PamNavBadgeService, { optional: true })?.count$ ?? of(0),
    { initialValue: 0 },
  );
}
