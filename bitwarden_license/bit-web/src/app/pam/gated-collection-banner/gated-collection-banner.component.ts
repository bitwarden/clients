import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, Observable, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { CalloutModule } from "@bitwarden/components";

import { rulesGoverningCollection } from "../collection-access-rule-callout/access-rule-summary";
import { GovernedCollectionsService } from "../services/governed-collections.service";

/**
 * Explains, above the vault's item list, that the collection currently being viewed opens through
 * a request. Without it the list reads as an ordinary collection whose rows happen to be
 * unavailable, with nothing on screen saying why.
 *
 * Bound to `VAULT_GATED_COLLECTION_BANNER` in `provide-pam.ts`. The host passes the selected
 * collection only when exactly one is the active filter, so "All items" and the pseudo-collections
 * never reach this component; everything else — whether the organization has Privileged Access,
 * whether a rule governs the collection — is decided here so the vault stays PAM-free.
 *
 * "Governed" is the same claim the collection-row badge, the sidebar lock and the collection-dialog
 * callout make, derived from the same cached per-org read ({@link GovernedCollectionsService})
 * through the same {@link rulesGoverningCollection} predicate, so the four surfaces cannot drift.
 * The sentence is the sidebar lock's tooltip string verbatim, by the same requirement.
 *
 * The read is issued only for a collection whose own organization has Privileged Access. A member
 * can select a collection in any organization, and asking for the access rules of an organization
 * that cannot have any is a refused request and a logged error.
 */
@Component({
  selector: "app-pam-gated-collection-banner",
  templateUrl: "./gated-collection-banner.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalloutModule],
})
export class GatedCollectionBannerComponent {
  readonly organizationId = input<OrganizationId | undefined>(undefined);
  readonly collectionId = input<CollectionId | undefined>(undefined);

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
    toObservable(this.organizationId),
    toObservable(this.collectionId),
    this.configService.getFeatureFlag$(FeatureFlag.Pam),
    this.pamOrganizationIds$,
  ]).pipe(
    switchMap(([organizationId, collectionId, enabled, pamOrganizationIds]) => {
      if (
        !enabled ||
        organizationId == null ||
        collectionId == null ||
        !pamOrganizationIds.has(organizationId)
      ) {
        return of(false);
      }
      return this.governedCollections
        .rules$(organizationId)
        .pipe(map((rules) => rulesGoverningCollection(rules, collectionId).length > 0));
    }),
  );

  protected readonly gated = toSignal(this.gated$, { initialValue: false });
}
