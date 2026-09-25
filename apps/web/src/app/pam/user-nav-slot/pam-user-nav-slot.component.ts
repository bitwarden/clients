import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Renders the "Access requests" nav item in the individual user side nav when
 * {@link FeatureFlag.Pam} is on and the user belongs to a PAM-enabled organization (`usePam`).
 */
@Component({
  selector: "app-pam-user-nav-slot",
  templateUrl: "./pam-user-nav-slot.component.html",
  host: { class: "tw-contents" },
  imports: [I18nPipe, NavigationModule],
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
}
