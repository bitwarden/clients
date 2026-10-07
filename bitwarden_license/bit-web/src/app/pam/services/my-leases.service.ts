import { Injectable } from "@angular/core";
import { catchError, defer, map, Observable, of, shareReplay } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";

import type { AccessLeaseView } from "../abstractions/access-lease";
import { AccessLeaseSdkService } from "../abstractions/access-lease-sdk.service";

/** How long a cached read serves new consumers, checked lazily on access. */
const CACHE_TTL_MS = 30_000;

type CacheEntry = { fetchedAt: number; leases$: Observable<readonly AccessLeaseView[]> };

/**
 * One cached `listMyLeases` read, for an item that became reachable through a rule-less collection
 * after its lease was minted. A failed read resolves to no leases, so the gate stays shut.
 */
@Injectable()
export class MyLeasesService {
  private cache: CacheEntry | null = null;

  constructor(
    private readonly accessLeaseSdkService: AccessLeaseSdkService,
    private readonly logService: LogService,
  ) {}

  /** The caller's leases; replayed to every subscriber, empty on failure. */
  leases$(): Observable<readonly AccessLeaseView[]> {
    const cached = this.cache;
    if (cached != null && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.leases$;
    }

    const leases$ = defer(() => this.accessLeaseSdkService.listMyLeases()).pipe(
      catchError((error: unknown) => {
        this.logService.error(error);
        return of<AccessLeaseView[]>([]);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.cache = { fetchedAt: Date.now(), leases$ };
    return leases$;
  }

  hasActiveLease$(cipherId: string): Observable<boolean> {
    return this.leases$().pipe(
      map((leases) =>
        leases.some(
          (lease) => lease.status === "active" && uuidAsString(lease.cipherId) === cipherId,
        ),
      ),
    );
  }

  /**
   * Call after ending or extending a lease, or a gate it opened stays open for up to
   * {@link CACHE_TTL_MS}.
   */
  invalidate(): void {
    this.cache = null;
  }
}
