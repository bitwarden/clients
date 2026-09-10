import { Injectable } from "@angular/core";
import { catchError, defer, Observable, of, shareReplay } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import type { AccessRuleView } from "../abstractions/access-rule";
import { AccessRuleSdkService } from "../abstractions/access-rule-sdk.service";

/**
 * How long a cached per-org read is served before a new consumer triggers a fresh one, bounding
 * staleness while collapsing repeated dialog opens into one read. Checked lazily on access, so
 * an already-open callout keeps its value.
 */
const CACHE_TTL_MS = 30_000;

type CacheEntry = { fetchedAt: number; rules$: Observable<readonly AccessRuleView[]> };

/**
 * One shared, cached `listAccessRules` read per organization, backing the collection-dialog
 * callout via `rulesGoverningCollection`.
 *
 * The callout needs the rules themselves, since it names them and summarises what they
 * enforce — a boolean can't say that; the vault-row badge instead reads the collection's own
 * `hasEnabledAccessRule`, computed server-side from the same "governed" definition.
 *
 * An informational consumer only: a failed read resolves to no rules rather than erroring the
 * host surface.
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

  /**
   * Drop the cached read so the next `rules$` call re-fetches rather than serving a value that
   * predates a write. Call after any successful access-rule create/update/delete — otherwise a
   * collection freed (or newly governed) by that write can stay wrong for up to
   * {@link CACHE_TTL_MS}, with no in-app way to force a refresh (root-scoped cache, SPA
   * navigation).
   */
  invalidate(organizationId: OrganizationId): void {
    this.cache.delete(organizationId);
  }
}
