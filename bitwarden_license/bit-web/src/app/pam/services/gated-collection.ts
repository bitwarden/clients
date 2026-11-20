import { inject, Signal } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, distinctUntilChanged, map, of, startWith, switchMap } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { rulesGoverningCollection } from "../collection-access-rule-callout/access-rule-summary";

import { GovernedCollectionsService } from "./governed-collections.service";

/**
 * Structural, so PAM needn't import the host's collection model. Both are optional, since a host
 * may have no selection or a pseudo-collection.
 */
export type GatedCollection = { id?: string; organizationId?: OrganizationId };

/**
 * Whether an enabled rule governs the collection, for surfaces handed ids rather than a collection
 * carrying `hasEnabledAccessRule`. Must be called from an injection context.
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
    map(([selected, enabled, pamOrganizationIds]) => {
      const { id, organizationId } = selected ?? {};
      return enabled &&
        id != null &&
        organizationId != null &&
        pamOrganizationIds.has(organizationId)
        ? { id, organizationId }
        : null;
    }),
    // Upstream re-emits on unrelated events, which would re-run the `startWith(false)` seed and
    // blink a settled banner.
    distinctUntilChanged((a, b) => a?.id === b?.id && a?.organizationId === b?.organizationId),
    switchMap((target) => {
      if (target == null) {
        return of(false);
      }
      // The host swaps one banner instance's inputs between collections, so without a seed the
      // previous verdict stands until the new read lands. A cached read emits synchronously.
      return governedCollections.rules$(target.organizationId).pipe(
        map((rules) => rulesGoverningCollection(rules, target.id).length > 0),
        startWith(false),
      );
    }),
  );

  return toSignal(gated$, { initialValue: false });
}
