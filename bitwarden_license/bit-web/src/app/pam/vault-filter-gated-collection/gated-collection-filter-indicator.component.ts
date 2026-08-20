import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, Observable, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { IconComponent } from "@bitwarden/components";

import { rulesGoverningCollection } from "../collection-access-rule-callout/access-rule-summary";
import { GovernedCollectionsService } from "../services/governed-collections.service";

/**
 * The collection fields the indicator reads, structurally — the sidebar passes its own
 * `CollectionFilter` node, which this component must not import to stay decoupled from the
 * admin-console models. Both fields are optional because the sidebar also renders
 * pseudo-collections ("All collections", "Unassigned") that carry neither.
 */
type FilterCollection = { id?: string; organizationId?: OrganizationId };

/**
 * Binds `VAULT_FILTER_GATED_COLLECTION_INDICATOR` for one collection in the vault's Filters
 * sidebar: a lock glyph on collections an enabled access rule governs, so a member can tell
 * before clicking that its items open through a request. Encapsulates every PAM dependency so
 * the sidebar stays PAM-free.
 *
 * "Governed" is the same claim the collection-dialog callout makes, derived from the same cached
 * per-org read ({@link GovernedCollectionsService}) through the same {@link rulesGoverningCollection}
 * predicate. The collection-row badge asserts the same thing from the server-derived
 * `hasEnabledAccessRule`, which the server computes as "associated with an enabled rule" — the same
 * condition this predicate filters for.
 *
 * The read is issued only for a collection whose own organization has Privileged Access. The
 * sidebar lists every organization's collections together, and asking for the access rules of an
 * organization that cannot have any is a refused request and a logged error — the same
 * per-organization narrowing the Controlled access column applies to its rows.
 */
@Component({
  selector: "app-pam-gated-collection-filter-indicator",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: "./gated-collection-filter-indicator.component.html",
})
export class GatedCollectionFilterIndicatorComponent {
  readonly collection = input<FilterCollection | null>(null);

  private readonly configService = inject(ConfigService);
  private readonly governedCollections = inject(GovernedCollectionsService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);

  protected readonly requiresRequestLabel = inject(I18nService).t("pamCollectionRequiresRequest");

  private readonly pamOrganizationIds$ = this.accountService.activeAccount$.pipe(
    getOptionalUserId,
    // `getUserId` throws on a signed-out account, which would tear down the whole stream.
    switchMap((userId) =>
      userId == null ? of([]) : this.organizationService.organizations$(userId),
    ),
    map((organizations) => new Set<string>(organizations.filter((o) => o.usePam).map((o) => o.id))),
  );

  private readonly gated$: Observable<boolean> = combineLatest([
    toObservable(this.collection),
    this.configService.getFeatureFlag$(FeatureFlag.Pam),
    this.pamOrganizationIds$,
  ]).pipe(
    switchMap(([collection, enabled, pamOrganizationIds]) => {
      const { id, organizationId } = collection ?? {};
      if (
        !enabled ||
        id == null ||
        organizationId == null ||
        !pamOrganizationIds.has(organizationId)
      ) {
        return of(false);
      }
      return this.governedCollections
        .rules$(organizationId)
        .pipe(map((rules) => rulesGoverningCollection(rules, id).length > 0));
    }),
  );

  protected readonly gated = toSignal(this.gated$, { initialValue: false });
}
