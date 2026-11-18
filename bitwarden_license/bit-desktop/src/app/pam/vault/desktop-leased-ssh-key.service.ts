import {
  catchError,
  combineLatest,
  concat,
  concatMap,
  defer,
  distinctUntilChanged,
  filter,
  finalize,
  from,
  ignoreElements,
  map,
  merge,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
  take,
  tap,
} from "rxjs";

import { AccessLeaseSdkService, AccessRefreshService, isLeaseLive } from "@bitwarden/bit-pam";
import type { AccessLeaseView } from "@bitwarden/bit-pam";
import { AccessBadgeTickerService } from "@bitwarden/bit-pam-components";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import {
  LeasedSshKey,
  LeasedSshKeyService,
} from "@bitwarden/desktop/autofill/abstractions/leased-ssh-key.service";

import { DesktopRevealedCipherService, RevealedEntry } from "./desktop-revealed-cipher.service";

/** Lease ends in ms, by cipher, of the gated SSH-key items the user holds a live lease on. */
type LeaseEnds = ReadonlyMap<CipherId, number>;

/**
 * The SSH keys of gated items the active, unlocked user holds a live lease on, for the desktop SSH
 * agent (`SshAgentService`). Each key comes from the full view `DesktopRevealedCipherService` holds
 * in renderer memory, which this service asks to reveal when a lease on a gated SSH-key item goes
 * live, and carries the end of its lease, so the agent drops it then. It holds only ids and lease
 * ends itself, never a key.
 *
 * Lease reads follow the reveal service's rules: re-read on every access change and once the
 * nearest lease lapses; a failed read keeps the last answer, which can hold a key until its lease
 * end but never grant one.
 */
export class DesktopLeasedSshKeyService implements LeasedSshKeyService {
  /** The lease ends behind the user's current keys, while their pipeline runs. No secrets. */
  private readonly leaseEnds = new Map<UserId, LeaseEnds>();

  constructor(
    private readonly revealedCipherService: DesktopRevealedCipherService,
    private readonly accessLeaseSdkService: AccessLeaseSdkService,
    private readonly accessRefreshService: AccessRefreshService,
    private readonly ticker: AccessBadgeTickerService,
    private readonly cipherService: CipherService,
    private readonly configService: ConfigService,
    private readonly organizationService: OrganizationService,
    private readonly accountService: AccountService,
    private readonly authService: AuthService,
    private readonly logService: LogService,
  ) {}

  leasedKeys$(userId: UserId): Observable<LeasedSshKey[]> {
    return this.eligible$(userId).pipe(
      switchMap((eligible) => {
        if (!eligible) {
          this.leaseEnds.delete(userId);
          return of<LeasedSshKey[]>([]);
        }
        return this.watch$(userId);
      }),
      distinctUntilChanged(sameKeys),
      // Once the agent stops listening (lock, logout, account switch, agent off), the sign path
      // must not find a key either.
      finalize(() => this.leaseEnds.delete(userId)),
    );
  }

  liveKeys(userId: UserId): LeasedSshKey[] {
    const ends = this.leaseEnds.get(userId);
    if (ends == null) {
      return [];
    }
    return [...ends.keys()]
      .map((cipherId) => this.liveKey(userId, cipherId))
      .filter((key): key is LeasedSshKey => key != null);
  }

  liveKey(userId: UserId, cipherId: CipherId): LeasedSshKey | undefined {
    const leaseEnd = this.leaseEnds.get(userId)?.get(cipherId);
    const entry = this.revealedCipherService.liveEntry(userId, cipherId);
    if (leaseEnd == null || entry == null) {
      return undefined;
    }
    return toLeasedKey(cipherId, entry, leaseEnd, Date.now());
  }

  /** PAM on, an organization using it, and the user active and unlocked. */
  private eligible$(userId: UserId): Observable<boolean> {
    return combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.Pam),
      this.organizationService
        .organizations$(userId)
        .pipe(map((organizations) => organizations.some((organization) => organization.usePam))),
      this.accountService.activeAccount$.pipe(map((account) => account?.id === userId)),
      this.authService
        .authStatusFor$(userId)
        .pipe(map((status) => status === AuthenticationStatus.Unlocked)),
    ]).pipe(
      map((conditions) => conditions.every(Boolean)),
      distinctUntilChanged(),
    );
  }

  private watch$(userId: UserId): Observable<LeasedSshKey[]> {
    const shared = <T>(source$: Observable<T>) =>
      source$.pipe(shareReplay({ bufferSize: 1, refCount: true }));
    const gatedIds$ = shared(this.gatedSshKeyIds$(userId));
    const leases$ = shared(this.leases$(userId));

    // Asks the reveal service for the full view of each gated SSH-key item whose lease is live,
    // and again after an extension, so the held view's lease end catches up. One at a time, so a
    // reveal that lands after a lock is dropped by the reveal service's own generation check.
    const reveal$ = combineLatest([gatedIds$, leases$]).pipe(
      concatMap(([gatedIds, leases]) =>
        from(
          (async () => {
            for (const [cipherId, leaseEnd] of liveLeaseEnds(gatedIds, leases, Date.now())) {
              const held = this.revealedCipherService.liveEntry(userId, cipherId);
              if (held == null || held.endsAt < leaseEnd) {
                await this.revealedCipherService.refresh(userId, cipherId);
              }
            }
          })(),
        ).pipe(
          catchError((error: unknown) => {
            this.logService.error(error);
            return of(undefined);
          }),
        ),
      ),
      ignoreElements(),
    );

    // Rebuilt on every input change and, while any key is held, on the shared clock, so a lapsed
    // lease drops its key within a tick even before a re-read.
    const keys$ = combineLatest([
      gatedIds$,
      leases$,
      this.revealedCipherService.revealedEntries$(userId),
    ]).pipe(
      switchMap(([gatedIds, leases, entries]) => {
        const build = (nowMs: number) => {
          const ends = liveLeaseEnds(gatedIds, leases, nowMs);
          this.leaseEnds.set(userId, ends);
          return [...ends]
            .map(([cipherId, leaseEnd]) => {
              const entry = entries.get(cipherId);
              return entry == null ? undefined : toLeasedKey(cipherId, entry, leaseEnd, nowMs);
            })
            .filter((key): key is LeasedSshKey => key != null);
        };
        const first = build(Date.now());
        return first.length === 0
          ? of(first)
          : this.ticker.ticks$.pipe(map(build), startWith(first));
      }),
    );

    return merge(reveal$, keys$);
  }

  /** The ids of the user's gated (restricted) SSH-key items still in the vault. */
  private gatedSshKeyIds$(userId: UserId): Observable<ReadonlySet<CipherId>> {
    return this.cipherService.cipherListViewsIncludingRestricted$(userId).pipe(
      map(
        (views) =>
          new Set(
            (views ?? [])
              .filter(
                (view) =>
                  CipherViewLikeUtils.isRestricted(view) &&
                  isSshKeyType(view) &&
                  !CipherViewLikeUtils.isDeleted(view) &&
                  !CipherViewLikeUtils.isArchived(view),
              )
              .map((view) => CipherViewLikeUtils.getId(view))
              .filter((id): id is CipherId => id != null),
          ),
      ),
      distinctUntilChanged((a, b) => a.size === b.size && [...a].every((id) => b.has(id))),
    );
  }

  /** The user's leases, read on start, on every access change and once the nearest one lapses. */
  private leases$(userId: UserId): Observable<readonly AccessLeaseView[]> {
    return defer(() => {
      let held: readonly AccessLeaseView[] = [];
      const read$ = (): Observable<readonly AccessLeaseView[]> =>
        defer(() => this.accessLeaseSdkService.listMyLeases(userId)).pipe(
          catchError((error: unknown) => {
            this.logService.error(error);
            return of(held);
          }),
          tap((leases) => (held = leases)),
          switchMap((leases) => {
            const live = leases.filter((lease) => isActive(lease, Date.now()));
            if (live.length === 0) {
              return of(leases);
            }
            const nearestEnd = Math.min(...live.map((lease) => Date.parse(lease.notAfter)));
            return concat(
              of(leases),
              this.ticker.ticks$.pipe(
                filter((nowMs) => nowMs >= nearestEnd),
                take(1),
                switchMap(read$),
              ),
            );
          }),
        );
      return this.accessRefreshService
        .accessChanged$()
        .pipe(startWith(undefined), switchMap(read$));
    });
  }
}

/** An unknown type is not an SSH key; it must not end the agent's key pipeline either. */
function isSshKeyType(view: CipherViewLike): boolean {
  try {
    return CipherViewLikeUtils.getType(view) === CipherType.SshKey;
  } catch {
    return false;
  }
}

function isActive(lease: AccessLeaseView, nowMs: number): boolean {
  return lease.status === "active" && isLeaseLive(lease, nowMs);
}

/** The live lease ends of the gated SSH-key items, the earliest end where a cipher has two. */
function liveLeaseEnds(
  gatedIds: ReadonlySet<CipherId>,
  leases: readonly AccessLeaseView[],
  nowMs: number,
): LeaseEnds {
  const ends = new Map<CipherId, number>();
  for (const lease of leases) {
    const cipherId = uuidAsString(lease.cipherId) as CipherId;
    if (!gatedIds.has(cipherId) || !isActive(lease, nowMs)) {
      continue;
    }
    const end = Date.parse(lease.notAfter);
    ends.set(cipherId, Math.min(end, ends.get(cipherId) ?? end));
  }
  return ends;
}

/**
 * The agent's key for a revealed SSH-key view, ending at the earlier of the lease and the reveal,
 * or nothing once either has passed or the view has no usable key.
 */
function toLeasedKey(
  cipherId: CipherId,
  entry: RevealedEntry,
  leaseEnd: number,
  nowMs: number,
): LeasedSshKey | undefined {
  const { view } = entry;
  const leaseEndsAt = Math.min(leaseEnd, entry.endsAt);
  const privateKey = view.sshKey?.privateKey;
  if (
    leaseEndsAt <= nowMs ||
    view.type !== CipherType.SshKey ||
    view.isDeleted ||
    view.isArchived ||
    privateKey == null ||
    privateKey === ""
  ) {
    return undefined;
  }
  return { cipherId, name: view.name, privateKey, leaseEndsAt };
}

function sameKeys(a: LeasedSshKey[], b: LeasedSshKey[]): boolean {
  return (
    a.length === b.length &&
    a.every((key, i) => {
      const other = b[i];
      return (
        other.cipherId === key.cipherId &&
        other.name === key.name &&
        other.privateKey === key.privateKey &&
        other.leaseEndsAt === key.leaseEndsAt
      );
    })
  );
}
