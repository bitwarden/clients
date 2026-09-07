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
 * The collection fields the gating check reads, structurally — the host passes its own node,
 * which PAM must not import to stay decoupled from admin-console models. Both optional, since a
 * host may have no collection selected or a pseudo-collection carrying neither.
 */
export type GatedCollection = { id?: string; organizationId?: OrganizationId };

/**
 * Whether an enabled access rule governs the given collection, for the vault banner. Must be
 * called from an injection context.
 *
 * The collection-row badge and sidebar lock answer the same question more cheaply, off the
 * collection's own server-derived `hasEnabledAccessRule` — which also works for a provider
 * browsing a client org, since `listAccessRules` needs membership a provider lacks. The banner
 * can't take that shortcut: it's handed collection ids alone, never a collection.
 *
 * The rules read is issued only for a collection whose own organization has Privileged Access;
 * asking for any other organization's rules is a refused request and a logged error.
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
    // `getFeatureFlag$`/`pamOrganizationIds$` re-emit on unrelated upstream events with no
    // de-duplication of their own; without this, re-emissions would re-run the switchMap and
    // re-trigger its `startWith(false)` seed, blinking a settled banner off and back on.
    distinctUntilChanged((a, b) => a?.id === b?.id && a?.organizationId === b?.organizationId),
    switchMap((target) => {
      if (target == null) {
        return of(false);
      }
      // `startWith(false)` since the vault banner is ONE instance whose inputs the host swaps
      // between collections; without a seed, `switchMap` would leave the previous verdict
      // standing until the new read lands. A cached read still emits synchronously, so this adds
      // no flicker.
      return governedCollections.rules$(target.organizationId).pipe(
        map((rules) => rulesGoverningCollection(rules, target.id).length > 0),
        startWith(false),
      );
    }),
  );

  return toSignal(gated$, { initialValue: false });
}
