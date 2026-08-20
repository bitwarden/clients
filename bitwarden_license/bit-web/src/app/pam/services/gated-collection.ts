import { inject, Signal } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, of, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { rulesGoverningCollection } from "../collection-access-rule-callout/access-rule-summary";

import { GovernedCollectionsService } from "./governed-collections.service";

/**
 * The collection fields the gating check reads, structurally — hosts pass their own node
 * (the sidebar's `CollectionFilter`, the vault's selected filter), which PAM must not import to
 * stay decoupled from the admin-console models. Both fields are optional because a host may have
 * no collection selected, or a pseudo-collection ("All collections", "Unassigned") that carries
 * neither.
 */
export type GatedCollection = { id?: string; organizationId?: OrganizationId };

/**
 * Whether an enabled access rule governs the given collection: the single claim behind the
 * sidebar lock and the vault banner, so those two surfaces cannot drift. Must be called from an
 * injection context. The collection-dialog callout asks the same underlying question, but reads
 * directly from `GovernedCollectionsService` / `rulesGoverningCollection` rather than going
 * through this helper. The collection-row badge makes a different claim, reading the collection's
 * own `hasEnabledAccessRule` instead: it needs only the boolean, while this helper and the callout
 * name the governing rules.
 *
 * The rules read is issued only for a collection whose own organization has Privileged Access:
 * a member can select a collection in any organization, and asking for the access rules of an
 * organization that cannot have any is a refused request and a logged error.
 */
export function gatedCollection(
  collection: Signal<GatedCollection | null | undefined>,
): Signal<boolean> {
  const configService = inject(ConfigService);
  const governedCollections = inject(GovernedCollectionsService);
  const accountService = inject(AccountService);
  const organizationService = inject(OrganizationService);

  const pamOrganizationIds$ = accountService.activeAccount$.pipe(
    getOptionalUserId,
    // `getUserId` throws on a signed-out account, which would tear down the whole stream.
    switchMap((userId) => (userId == null ? of([]) : organizationService.organizations$(userId))),
    map((organizations) => new Set<string>(organizations.filter((o) => o.usePam).map((o) => o.id))),
  );

  const gated$ = combineLatest([
    toObservable(collection),
    configService.getFeatureFlag$(FeatureFlag.Pam),
    pamOrganizationIds$,
  ]).pipe(
    switchMap(([selected, enabled, pamOrganizationIds]) => {
      const { id, organizationId } = selected ?? {};
      if (
        !enabled ||
        id == null ||
        organizationId == null ||
        !pamOrganizationIds.has(organizationId)
      ) {
        return of(false);
      }
      return governedCollections
        .rules$(organizationId)
        .pipe(map((rules) => rulesGoverningCollection(rules, id).length > 0));
    }),
  );

  return toSignal(gated$, { initialValue: false });
}
