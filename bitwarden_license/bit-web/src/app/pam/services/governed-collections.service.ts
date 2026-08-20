import { Injectable } from "@angular/core";
import { catchError, defer, Observable, of, shareReplay } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import type { AccessRuleView } from "../abstractions/access-rule";
import { AccessRuleSdkService } from "../abstractions/access-rule-sdk.service";

/**
 * How long a cached per-org read is served before a new consumer triggers a fresh one. Bounds how
 * stale the callout can be after rules change, while collapsing repeated opens of the collection
 * dialog into one read. Expiry is checked lazily on access (no timers), so an already-open callout
 * keeps its value and the next open re-reads.
 */
const CACHE_TTL_MS = 30_000;

type CacheEntry = { fetchedAt: number; rules$: Observable<readonly AccessRuleView[]> };

/**
 * One shared, cached `listAccessRules` read per organization, backing the collection-dialog
 * callout via `rulesGoverningCollection`.
 *
 * The vault-row "Privileged" badge used to derive from this too, but now reads the collection's
 * own server-derived `hasEnabledAccessRule`. The callout still needs the rules themselves because
 * it *names* the governing rules and summarises what they enforce — a boolean cannot say that.
 * Both surfaces nonetheless agree on what "governed" means: the server computes the flag as
 * "associated with a rule that is enabled", which is exactly what `rulesGoverningCollection`
 * filters for.
 *
 * An informational consumer only, so a failed read resolves to no rules (the callout simply
 * doesn't render) rather than erroring the host surface.
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
