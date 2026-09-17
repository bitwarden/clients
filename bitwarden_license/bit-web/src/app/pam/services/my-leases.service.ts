import { Injectable } from "@angular/core";
import { catchError, defer, map, Observable, of, shareReplay } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";

import type { AccessLeaseView } from "../abstractions/access-lease";
import { AccessLeaseSdkService } from "../abstractions/access-lease-sdk.service";

/**
 * How long a cached read is served before a new consumer triggers a fresh one, bounding staleness
 * while collapsing repeated item opens into one read. Checked lazily on access, matching
 * `GovernedCollectionsService`.
 */
const CACHE_TTL_MS = 30_000;

type CacheEntry = { fetchedAt: number; leases$: Observable<readonly AccessLeaseView[]> };

/**
 * One shared, cached `listMyLeases` read, backing the cipher-view banner's gate for an item the
 * server no longer gates.
 *
 * A lease can only be minted while its cipher is gated, so this answers a question the cipher
 * itself cannot: the item later became reachable through a collection carrying no rule, leaving
 * `partial` unset and the credential fully readable, while the lease it was granted under is
 * still live and still the holder's to extend or end.
 *
 * Cached because the banner's gate exists to keep a plain item from firing a PAM read, and this
 * read is per-caller rather than per-item — one list answers every item the caller opens.
 *
 * An informational consumer only: a failed read resolves to no leases, leaving the gate shut
 * rather than erroring the open item.
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

  /** Whether the caller holds a live lease on `cipherId`. */
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
   * Drop the cached read. Call after ending or extending a lease: otherwise a gate opened by a
   * lease that no longer exists stays open for up to {@link CACHE_TTL_MS}.
   */
  invalidate(): void {
    this.cache = null;
  }
}
