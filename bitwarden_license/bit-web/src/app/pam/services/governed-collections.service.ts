import { Injectable } from "@angular/core";
import { catchError, defer, Observable, of, shareReplay } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import type { AccessRuleView } from "../abstractions/access-rule";
import { AccessRuleSdkService } from "../abstractions/access-rule-sdk.service";

/**
 * How long a cached per-organization read serves new consumers. Checked lazily, so an open callout
 * keeps its value.
 */
const CACHE_TTL_MS = 30_000;

type CacheEntry = { fetchedAt: number; rules$: Observable<readonly AccessRuleView[]> };

/**
 * One cached `listAccessRules` read per organization, for surfaces that need the rules rather than
 * `hasEnabledAccessRule`. A failed read resolves to no rules, as every consumer is informational.
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
   * Call after any access-rule write, or a collection it freed or governed stays wrong for up to
   * {@link CACHE_TTL_MS} with no in-app way to refresh.
   */
  invalidate(organizationId: OrganizationId): void {
    this.cache.delete(organizationId);
  }
}
