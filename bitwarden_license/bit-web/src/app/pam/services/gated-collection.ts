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
 * through this helper, because it names the governing rules rather than just counting them.
 *
 * The collection-row badge answers the same question from the collection's own server-derived
 * `hasEnabledAccessRule`. Neither caller of this helper can take that shortcut, and the reason is
 * invisible at both call sites: the sidebar's nodes carry a silently FALSE flag rather than an
 * absent one, because `buildCollectionTree` rebuilds each one through `new CollectionView(...)`,
 * whose constructor copies only id/organizationId/name while the field initializer resets
 * `hasEnabledAccessRule` to `false`; and the banner is handed ids alone, never a collection. A
 * "simplification" that reads the flag here would compile, pass a naive test, and never gate.
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
    map(([selected, enabled, pamOrganizationIds]) => {
      const { id, organizationId } = selected ?? {};
      return enabled &&
        id != null &&
        organizationId != null &&
        pamOrganizationIds.has(organizationId)
        ? { id, organizationId }
        : null;
    }),
    // `getFeatureFlag$` and `pamOrganizationIds$` both re-emit on unrelated upstream events (a
    // config refresh, any sync write), with no de-duplication of their own. Without this, those
    // re-emissions would re-run the switchMap below for the SAME collection and re-trigger its
    // `startWith(false)` seed, blinking a settled banner/lock off and back on.
    distinctUntilChanged((a, b) => a?.id === b?.id && a?.organizationId === b?.organizationId),
    switchMap((target) => {
      if (target == null) {
        return of(false);
      }
      // `startWith(false)` because the vault banner is ONE component instance whose inputs the
      // host swaps as the user moves between collections. Without a seed, `switchMap` leaves the
      // previous collection's verdict standing until the new read lands, so the banner would keep
      // asserting "requires a request" over an ungated collection's items for the length of a
      // network round trip. A cached read still emits synchronously, so this adds no flicker.
      return governedCollections.rules$(target.organizationId).pipe(
        map((rules) => rulesGoverningCollection(rules, target.id).length > 0),
        startWith(false),
      );
    }),
  );

  return toSignal(gated$, { initialValue: false });
}
