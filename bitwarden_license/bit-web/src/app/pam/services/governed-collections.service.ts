import { Injectable } from "@angular/core";
import { catchError, defer, Observable, of, shareReplay } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import type { AccessRuleView } from "../abstractions/access-rule";
import { AccessRuleSdkService } from "../abstractions/access-rule-sdk.service";

/**
 * How long a cached per-org read is served before a new consumer triggers a fresh one.
 * Collection rows live under a virtual scroller with no template cache, so badge subscriptions
 * churn on every scroll pass — the TTL absorbs that churn with one read, while still bounding
 * how stale the badge and callout can be after rules change. Expiry is checked lazily on
 * access (no timers), so already-mounted rows keep their value and the next mount re-reads.
 */
const CACHE_TTL_MS = 30_000;

type CacheEntry = { fetchedAt: number; rules$: Observable<readonly AccessRuleView[]> };

/**
 * One shared, cached `listAccessRules` read per organization — the source both the
 * collection-row badge and the collection-dialog callout derive from (via
 * `rulesGoverningCollection`), so a vault list of N collections issues one read, not N,
 * and "governed" cannot mean two different things on two surfaces.
 *
 * Informational consumers only, so a failed read resolves to no rules (badge and callout
 * simply don't render) rather than erroring the host surfaces.
 */
@Injectable()
export class GovernedCollectionsService {
  private readonly cache = new Map<OrganizationId, CacheEntry>();

  constructor(
    private readonly accessRuleSdkService: AccessRuleSdkService,
    private readonly logService: LogService,
  ) {}

  /** The organization's access rules; replayed to every subscriber, empty on failure. */
  rules$(organizationId: OrganizationId): Observable<readonly AccessRuleView[]> {
    const cached = this.cache.get(organizationId);
    if (cached != null && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.rules$;
    }

    const rules$ = defer(() => this.accessRuleSdkService.listAccessRules(organizationId)).pipe(
      catchError((error: unknown) => {
        this.logService.error(error);
        return of([]);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.cache.set(organizationId, { fetchedAt: Date.now(), rules$ });
    return rules$;
  }
}
