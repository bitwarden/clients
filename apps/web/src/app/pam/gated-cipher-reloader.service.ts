import { Injectable, inject } from "@angular/core";
import { distinctUntilChanged, from, map, Observable, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { LeasedCipherFetcherService, PamApiService } from "@bitwarden/pam";
import { GatedCipherReloader } from "@bitwarden/vault";

/**
 * Reveals the full cipher in an already-open view once a lease covers it.
 *
 * Watches the cipher's access-state snapshot: while it carries no active lease
 * the stream stays `null` and the partial view holds. When a lease appears —
 * e.g. the member just started an approved request from the lease banner — it
 * fetches the full, decryptable cipher once and emits it so the dialog can swap
 * the partial cipher in place. `distinctUntilChanged` on the lease id means an
 * unrelated state re-emit doesn't re-fetch. The leased Cipher is transient and
 * is never written to the local cache — every view re-fetches.
 */
@Injectable({ providedIn: "root" })
export class PamGatedCipherReloader implements GatedCipherReloader {
  private readonly pamApiService = inject(PamApiService);
  private readonly leasedCipherFetcher = inject(LeasedCipherFetcherService);
  private readonly accountService = inject(AccountService);

  fullCipher$(cipherId: string): Observable<Cipher | null> {
    return getUserId(this.accountService.activeAccount$).pipe(
      switchMap((userId) => this.pamApiService.getCipherAccessState$(cipherId, userId)),
      map((state) => state.activeLease?.id ?? null),
      distinctUntilChanged(),
      switchMap((leaseId) =>
        leaseId == null ? of(null) : from(this.leasedCipherFetcher.fetch(cipherId)),
      ),
    );
  }
}
