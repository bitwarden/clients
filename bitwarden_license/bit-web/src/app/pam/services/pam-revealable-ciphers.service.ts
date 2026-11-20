import {
  combineLatest,
  concat,
  distinctUntilChanged,
  filter,
  from,
  map,
  merge,
  Observable,
  of,
  switchMap,
  take,
} from "rxjs";

import { AccessLeaseSdkService, AccessRefreshService, isLeaseLive } from "@bitwarden/bit-pam";
import type { AccessLeaseView } from "@bitwarden/bit-pam";
import { AccessBadgeTickerService } from "@bitwarden/bit-pam-components";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { RevealableCiphers } from "@bitwarden/vault";

const NONE: ReadonlySet<CipherId> = new Set();

/**
 * The ciphers the caller holds a live lease on, so the vault row menu offers edit, attachments,
 * delete and restore before the item is opened. One `listMyLeases` read serves every row. It is
 * read again on every access change and once a lease lapses, since nothing announces a lease
 * running out and it may have been extended without this surface hearing of it.
 *
 * A lapse emits outside the Angular zone, on the shared ticker. The row menu reads this through a
 * signal, which needs nothing more; a consumer that writes plain fields must re-enter the zone.
 */
export class PamRevealableCiphersService implements RevealableCiphers {
  constructor(
    private readonly accessLeaseSdkService: AccessLeaseSdkService,
    private readonly accessRefreshService: AccessRefreshService,
    private readonly ticker: AccessBadgeTickerService,
    private readonly accountService: AccountService,
    private readonly organizationService: OrganizationService,
    private readonly configService: ConfigService,
    private readonly logService: LogService,
  ) {}

  /**
   * The reads run as the active user, so another user gets none. A user with no organization that
   * releases leased secrets gets none without a read, so the vault does not pay for it.
   */
  revealable$(userId: UserId): Observable<ReadonlySet<CipherId>> {
    return combineLatest([
      this.accountService.activeAccount$.pipe(map((account) => account?.id === userId)),
      this.configService.getFeatureFlag$(FeatureFlag.Pam),
      this.organizationService
        .organizations$(userId)
        .pipe(
          map((organizations) =>
            organizations.some((organization) => organization.canAccessPrivilegedAccess),
          ),
        ),
    ]).pipe(
      map(([active, enabled, licensed]) => active && enabled && licensed),
      distinctUntilChanged(),
      switchMap((allowed) =>
        allowed
          ? merge(of(undefined), this.accessRefreshService.accessChanged$()).pipe(
              switchMap(() => this.readUntilLapse$(userId)),
            )
          : of(NONE),
      ),
      distinctUntilChanged((a, b) => a.size === b.size && [...a].every((id) => b.has(id))),
    );
  }

  /** The leased cipher IDs, dropping the first lease to lapse and then reading again. */
  private readUntilLapse$(userId: UserId): Observable<ReadonlySet<CipherId>> {
    return from(this.readLiveLeases(userId)).pipe(
      switchMap((leases) => {
        if (leases.length === 0) {
          return of(NONE);
        }
        const firstEndMs = Math.min(...leases.map((lease) => Date.parse(lease.notAfter)));
        return concat(
          of(leasedIds(leases, Date.now())),
          this.ticker.ticks$.pipe(
            filter((nowMs) => nowMs >= firstEndMs),
            take(1),
            switchMap((nowMs) =>
              concat(of(leasedIds(leases, nowMs)), this.readUntilLapse$(userId)),
            ),
          ),
        );
      }),
    );
  }

  /** A failed read reports no leases, so the menu fails closed; the server still gates writes. */
  private async readLiveLeases(userId: UserId): Promise<AccessLeaseView[]> {
    try {
      const leases = await this.accessLeaseSdkService.listMyLeases(userId);
      const nowMs = Date.now();
      return leases.filter((lease) => lease.status === "active" && isLeaseLive(lease, nowMs));
    } catch (error: unknown) {
      this.logService.error(error);
      return [];
    }
  }
}

function leasedIds(leases: readonly AccessLeaseView[], nowMs: number): ReadonlySet<CipherId> {
  return new Set(
    leases
      .filter((lease) => isLeaseLive(lease, nowMs))
      .map((lease) => uuidAsString(lease.cipherId) as CipherId),
  );
}
