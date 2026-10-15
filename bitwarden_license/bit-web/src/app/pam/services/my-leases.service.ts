import { Injectable } from "@angular/core";
import { catchError, defer, firstValueFrom, map, Observable, of, shareReplay } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherLeaseStateService } from "@bitwarden/common/vault/abstractions/cipher-lease-state.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";

import type { AccessLeaseView } from "../abstractions/access-lease";
import { AccessLeaseSdkService } from "../abstractions/access-lease-sdk.service";
import { isLeaseLive } from "../helpers/lease-liveness";

/** How long a cached read serves new consumers, checked lazily on access. */
const CACHE_TTL_MS = 30_000;

type CacheEntry = { fetchedAt: number; leases$: Observable<readonly AccessLeaseView[]> };

/**
 * One cached `listMyLeases` read, for an item that became reachable through a rule-less collection
 * after its lease was minted, and for `CipherService`'s write gate. A failed read resolves to no
 * leases, so both gates stay shut, and isn't cached, so the next read retries.
 */
@Injectable()
export class MyLeasesService implements CipherLeaseStateService {
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
        if (this.cache?.leases$ === leases$) {
          this.cache = null;
        }
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

  /** Always reads fresh, so a lease started or ended elsewhere counts at once. Refreshes the cache. */
  async leasedCipherIds(): Promise<Set<string>> {
    this.invalidate();
    const leases = await firstValueFrom(this.leases$());
    const nowMs = Date.now();
    return new Set(
      leases
        .filter((l) => l.status === "active" && isLeaseLive(l, nowMs))
        .map((l) => uuidAsString(l.cipherId)),
    );
  }

  /** Web reveals through its gated-cipher reloader and keeps no leased copies. */
  leasedCiphers$(): Observable<Cipher[]> {
    return of([]);
  }

  /**
   * Call after ending or extending a lease, or a gate it opened stays open for up to
   * {@link CACHE_TTL_MS}.
   */
  invalidate(): void {
    this.cache = null;
  }
}
