import { AsyncPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, input, model } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, map, Observable, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import type { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  A11yTitleDirective,
  IconModule,
  IconTileComponent,
  IconTileOptions,
  NavigationModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { orgIconTile } from "@bitwarden/vault";
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "org-switcher",
  templateUrl: "org-switcher.component.html",
  imports: [
    AsyncPipe,
    I18nPipe,
    A11yTitleDirective,
    NavigationModule,
    IconModule,
    IconTileComponent,
  ],
})
export class OrgSwitcherComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly organizationService = inject(OrganizationService);
  private readonly accountService = inject(AccountService);

  /** Under VFO1, "Add plan" in Settings replaces the "New organization" entry. */
  protected readonly vfo1Enabled = toSignal(
    inject(ConfigService).getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  protected readonly organizations$: Observable<Organization[]> =
    this.accountService.activeAccount$.pipe(
      getOptionalUserId,
      switchMap((userId) =>
        userId == null ? of([]) : this.organizationService.organizations$(userId),
      ),
      map((orgs) =>
        orgs.filter((org) => this.filter()(org)).sort((a, b) => a.name.localeCompare(b.name)),
      ),
    );

  protected readonly activeOrganization$: Observable<Organization | undefined> = combineLatest([
    this.route.paramMap,
    this.organizations$,
  ]).pipe(map(([params, orgs]) => orgs.find((org) => org.id === params.get("organizationId"))));

  /** The active organization with the tier-colored icon tile it shares with the vault switcher. */
  protected readonly activeOrganizationView$: Observable<
    { organization: Organization; tile: IconTileOptions } | undefined
  > = this.activeOrganization$.pipe(
    map(
      (organization) =>
        organization && { organization, tile: orgIconTile(organization.productTierType) },
    ),
  );

  /**
   * Filter function for displayed organizations in the `org-switcher`
   * @example
   * const smFilter = (org: Organization) => org.canAccessSecretsManager
   * // <org-switcher [filter]="smFilter">
   */
  readonly filter = input<(org: Organization) => boolean>(() => true);

  /**
   * Is `true` if the expanded content is visible
   */
  readonly open = model(false);

  /**
   * Visibility of the New Organization button
   */
  readonly hideNewButton = input(false);

  protected toggle(event?: MouseEvent) {
    event?.stopPropagation();
    this.open.update((open) => !open);
  }
}
