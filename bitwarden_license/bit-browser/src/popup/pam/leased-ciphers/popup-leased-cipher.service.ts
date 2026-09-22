import { Injectable, NgZone, inject } from "@angular/core";
import {
  combineLatest,
  concat,
  distinctUntilChanged,
  from,
  map,
  merge,
  MonoTypeOperatorFunction,
  Observable,
  of,
  shareReplay,
  switchMap,
  takeWhile,
} from "rxjs";

import { AccessLeaseSdkService, AccessRefreshService } from "@bitwarden/bit-common/pam";
import type { AccessLeaseView } from "@bitwarden/bit-common/pam";
import { AccessBadgeTickerService } from "@bitwarden/bit-common/pam/access-state-badge/access-badge-ticker.service";
import { fetchLeasedCipher } from "@bitwarden/bit-common/pam/helpers/leased-cipher";
import { LeasedCipherSource } from "@bitwarden/browser/vault/popup/components/vault/vault-list-items-container/leased-cipher-source.token";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

type LeasedEntry = { cipherId: string; view: CipherView; notAfterMs: number };

const NO_LEASED_VIEWS: ReadonlyMap<string, CipherView> = new Map();

/**
 * The popup's {@link LeasedCipherSource}: one `listMyLeases` read per refresh, then the full
 * cipher for each active lease, decrypted and stamped `leaseGated`.
 *
 * Memory only: never persisted. Re-read on every `AccessRefreshService` event; an entry drops when
 * its lease's `notAfter` passes, and the map empties on lock, logout or account switch.
 */
@Injectable({ providedIn: "root" })
export class PopupLeasedCipherService implements LeasedCipherSource {
  private readonly accessLeaseSdkService = inject(AccessLeaseSdkService);
  private readonly accessRefreshService = inject(AccessRefreshService);
  private readonly accountService = inject(AccountService);
  private readonly authService = inject(AuthService);
  private readonly organizationService = inject(OrganizationService);
  private readonly configService = inject(ConfigService);
  private readonly apiService = inject(ApiService);
  private readonly cipherService = inject(CipherService);
  private readonly logService = inject(LogService);
  private readonly ticker = inject(AccessBadgeTickerService);
  private readonly ngZone = inject(NgZone);

  private readonly perUser = new Map<UserId, Observable<ReadonlyMap<string, CipherView>>>();

  leasedCipherViews$(userId: UserId): Observable<ReadonlyMap<string, CipherView>> {
    let views$ = this.perUser.get(userId);
    if (views$ == null) {
      views$ = this.canHoldLeases$(userId).pipe(
        switchMap((canHold) =>
          canHold ? this.leasedWhileAvailable$(userId) : of(NO_LEASED_VIEWS),
        ),
        distinctUntilChanged(sameViews),
        this.inAngularZone(),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
      this.perUser.set(userId, views$);
    }
    return views$;
  }

  /** `userId` is the active, unlocked account, PAM is on, and one of its organizations grants it. */
  private canHoldLeases$(userId: UserId): Observable<boolean> {
    return combineLatest([
      this.accountService.activeAccount$.pipe(map((account) => account?.id === userId)),
      this.authService
        .authStatusFor$(userId)
        .pipe(map((status) => status === AuthenticationStatus.Unlocked)),
      this.configService.getFeatureFlag$(FeatureFlag.Pam),
      this.organizationService
        .organizations$(userId)
        .pipe(map((orgs) => orgs.some((org) => org.canAccessPrivilegedAccess))),
    ]).pipe(
      map((conditions) => conditions.every(Boolean)),
      distinctUntilChanged(),
    );
  }

  private leasedWhileAvailable$(userId: UserId): Observable<ReadonlyMap<string, CipherView>> {
    return merge(of(undefined), this.accessRefreshService.accessChanged$()).pipe(
      switchMap(() => from(this.activeLeases())),
      switchMap((leases) =>
        leases.length === 0
          ? of(NO_LEASED_VIEWS)
          : from(this.decryptLeased(leases, userId)).pipe(
              switchMap((entries) => this.untilLeasesLapse$(entries)),
            ),
      ),
    );
  }

  /** The live entries, re-filtered on the shared badge clock until the last one lapses. */
  private untilLeasesLapse$(entries: LeasedEntry[]): Observable<ReadonlyMap<string, CipherView>> {
    if (entries.length === 0) {
      return of(NO_LEASED_VIEWS);
    }
    return concat(of(Date.now()), this.ticker.ticks$).pipe(
      map((nowMs) => toViewMap(entries.filter((entry) => entry.notAfterMs > nowMs))),
      distinctUntilChanged(sameViews),
      takeWhile((views) => views.size > 0, true),
    );
  }

  /** The caller's active, unexpired leases, one per cipher; none when the read fails. */
  private async activeLeases(): Promise<AccessLeaseView[]> {
    let leases: AccessLeaseView[];
    try {
      leases = await this.accessLeaseSdkService.listMyLeases();
    } catch {
      return [];
    }
    const nowMs = Date.now();
    const byCipher = new Map<string, AccessLeaseView>();
    for (const lease of leases) {
      if (lease.status !== "active" || !(Date.parse(lease.notAfter) > nowMs)) {
        continue;
      }
      const cipherId = uuidAsString(lease.cipherId);
      const existing = byCipher.get(cipherId);
      if (existing == null || Date.parse(lease.notAfter) > Date.parse(existing.notAfter)) {
        byCipher.set(cipherId, lease);
      }
    }
    return [...byCipher.values()];
  }

  private async decryptLeased(leases: AccessLeaseView[], userId: UserId): Promise<LeasedEntry[]> {
    const entries = await Promise.all(
      leases.map(async (lease): Promise<LeasedEntry | null> => {
        const cipherId = uuidAsString(lease.cipherId);
        try {
          const cipher = await fetchLeasedCipher(this.apiService, cipherId);
          if (cipher == null) {
            return null;
          }
          const view = await this.cipherService.decrypt(cipher, userId);
          if (view == null || view.decryptionFailure) {
            return null;
          }
          view.leaseGated = true;
          return { cipherId, view, notAfterMs: Date.parse(lease.notAfter) };
        } catch (error: unknown) {
          this.logService.error(error);
          return null;
        }
      }),
    );
    return entries.filter((entry): entry is LeasedEntry => entry != null);
  }

  /** The badge clock ticks outside the zone; a re-lock must still reach change detection. */
  private inAngularZone<T>(): MonoTypeOperatorFunction<T> {
    return (source) =>
      new Observable<T>((subscriber) =>
        source.subscribe({
          next: (value) => this.ngZone.run(() => subscriber.next(value)),
          error: (error: unknown) => subscriber.error(error),
          complete: () => subscriber.complete(),
        }),
      );
  }
}

function toViewMap(entries: LeasedEntry[]): ReadonlyMap<string, CipherView> {
  return entries.length === 0
    ? NO_LEASED_VIEWS
    : new Map(entries.map((entry) => [entry.cipherId, entry.view]));
}

function sameViews(
  a: ReadonlyMap<string, CipherView>,
  b: ReadonlyMap<string, CipherView>,
): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const [id, view] of a) {
    if (b.get(id) !== view) {
      return false;
    }
  }
  return true;
}
