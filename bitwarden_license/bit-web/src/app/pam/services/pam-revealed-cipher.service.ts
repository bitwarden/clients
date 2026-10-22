import { NgZone } from "@angular/core";
import {
  BehaviorSubject,
  catchError,
  concatMap,
  defer,
  distinctUntilChanged,
  EMPTY,
  firstValueFrom,
  from,
  ignoreElements,
  map,
  merge,
  MonoTypeOperatorFunction,
  Observable,
  of,
  switchMap,
  tap,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { RestrictedCipherPolicy } from "@bitwarden/common/vault/utils/restricted-cipher-policy";

import { AccessRefreshService, AccessRequestSdkService, liveActiveLease, rereadOnLapse } from "..";
import type { CipherAccessStateView } from "../abstractions/access-lease";
import { AccessLeaseSdkService } from "../abstractions/access-lease-sdk.service";
import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";

/** A revealed view and the end of the lease it was revealed under, in ms. */
type Entry = { view: CipherView; endsAt: number };

/**
 * Holds the full view of a restricted cipher while the caller holds a live lease on it. The view
 * comes from the SDK's `leased_cipher`, which never writes it to the cipher repository; it lives in
 * process memory only, and goes when its lease lapses or the user locks or logs out.
 */
export class PamRevealedCipherService implements RevealedCipherService {
  private readonly entries$ = new BehaviorSubject<
    ReadonlyMap<UserId, ReadonlyMap<CipherId, Entry>>
  >(new Map());

  /** Bumped on every clear, so a reveal that resolves after a lock is not stored. */
  private readonly generations = new Map<UserId, number>();

  /** The latest auth statuses. A reveal is stored only for an unlocked user. */
  private statuses: Record<UserId, AuthenticationStatus> = {};

  constructor(
    private readonly accessRequestSdkService: AccessRequestSdkService,
    private readonly accessRefreshService: AccessRefreshService,
    private readonly ticker: AccessBadgeTickerService,
    private readonly accessLeaseSdkService: AccessLeaseSdkService,
    private readonly accountService: AccountService,
    authService: AuthService,
    private readonly ngZone: NgZone,
    private readonly logService: LogService,
  ) {
    // A root singleton, so neither subscription ends. Users missing from the record are logged out.
    authService.authStatuses$.subscribe((statuses) => {
      this.statuses = statuses;
      // Includes users with no views yet, so a reveal still in flight across a lock is not stored.
      const userIds = new Set([
        ...this.entries$.value.keys(),
        ...this.generations.keys(),
        ...(Object.keys(statuses) as UserId[]),
      ]);
      for (const userId of userIds) {
        if (statuses[userId] !== AuthenticationStatus.Unlocked) {
          this.clear(userId);
        }
      }
    });

    // Nothing announces a lease running out, so the shared clock drops lapsed views, but only
    // while there are any.
    this.entries$
      .pipe(
        map((all) => [...all.values()].some((entries) => entries.size > 0)),
        distinctUntilChanged(),
        switchMap((holding) => (holding ? this.ticker.ticks$ : EMPTY)),
      )
      .subscribe((nowMs) => this.dropLapsed(nowMs));
  }

  revealed$(userId: UserId): Observable<ReadonlyMap<CipherId, CipherView>> {
    return this.entries$.pipe(
      map((all) => {
        const nowMs = Date.now();
        const views = new Map<CipherId, CipherView>();
        all.get(userId)?.forEach((entry, cipherId) => {
          if (entry.endsAt > nowMs) {
            views.set(cipherId, entry.view);
          }
        });
        return views;
      }),
      distinctUntilChanged(
        (a, b) => a.size === b.size && [...a].every(([id, view]) => b.get(id) === view),
      ),
    );
  }

  isRevealed(userId: UserId, cipherId: CipherId): boolean {
    return this.get(userId, cipherId) != null;
  }

  get(userId: UserId, cipherId: CipherId): CipherView | undefined {
    const entry = this.entries$.value.get(userId)?.get(cipherId);
    return entry != null && entry.endsAt > Date.now() ? entry.view : undefined;
  }

  async getOrReveal(userId: UserId, cipherId: CipherId): Promise<CipherView | null> {
    const live = this.get(userId, cipherId);
    if (live != null) {
      return live;
    }
    const notAfter = await firstValueFrom(this.liveLeaseEnd$(userId, cipherId));
    return notAfter == null ? null : await this.reveal(userId, cipherId, notAfter);
  }

  async refresh(userId: UserId, cipherId: CipherId): Promise<void> {
    const notAfter = await firstValueFrom(this.liveLeaseEnd$(userId, cipherId));
    if (notAfter == null) {
      this.drop(userId, cipherId);
      return;
    }
    await this.reveal(userId, cipherId, notAfter);
  }

  displayView$(userId: UserId, storedView: CipherView): Observable<CipherView> {
    if (!RestrictedCipherPolicy.isRestricted(storedView)) {
      return of(storedView);
    }
    const cipherId = storedView.id as CipherId;

    // concatMap, not switchMap, or an in-flight reveal could land after a re-lock and leave
    // secrets on screen.
    const sync$ = this.liveLeaseEnd$(userId, cipherId).pipe(
      concatMap(async (notAfter) => {
        if (notAfter == null) {
          this.drop(userId, cipherId);
          return;
        }
        const held = this.entries$.value.get(userId)?.get(cipherId);
        if (held == null || held.endsAt < Date.parse(notAfter)) {
          await this.reveal(userId, cipherId, notAfter);
        }
      }),
      ignoreElements(),
    );
    const view$ = this.revealed$(userId).pipe(map((views) => views.get(cipherId) ?? storedView));

    return merge(sync$, view$).pipe(distinctUntilChanged());
  }

  /**
   * The `notAfter` of the caller's live lease on `cipherId`, or null. Read again on every access
   * change and once the lease lapses. The reads run as the active user, so another user gets null.
   */
  private liveLeaseEnd$(userId: UserId, cipherId: CipherId): Observable<string | null> {
    return this.accountService.activeAccount$.pipe(
      map((account) => account?.id === userId),
      distinctUntilChanged(),
      switchMap((active) => (active ? this.activeUserLeaseEnd$(cipherId) : of(null))),
    );
  }

  private activeUserLeaseEnd$(cipherId: CipherId): Observable<string | null> {
    return defer(() => {
      let held: CipherAccessStateView | null = null;
      const read$ = () =>
        from(this.accessRequestSdkService.getCipherAccessState(cipherId)).pipe(
          catchError((error: unknown) => {
            // A failed read keeps the last answer, so it can hold a reveal but never grant one.
            this.logService.error(error);
            return of(held);
          }),
          tap((state) => (held = state)),
        );

      return merge(of(undefined), this.accessRefreshService.accessChanged$(cipherId)).pipe(
        switchMap(() => rereadOnLapse(read$, this.ticker.ticks$)),
        map((state) => liveActiveLease(state, Date.now())?.notAfter ?? null),
        distinctUntilChanged(),
        this.inAngularZone(),
      );
    });
  }

  /**
   * Reads and stores the full view. A still-restricted response means the lease lapsed after the
   * state read, so it reports no access and drops the entry.
   */
  private async reveal(
    userId: UserId,
    cipherId: CipherId,
    notAfter: string,
  ): Promise<CipherView | null> {
    const generation = this.generations.get(userId) ?? 0;
    const view = await this.readLeasedView(cipherId);
    if (
      generation !== (this.generations.get(userId) ?? 0) ||
      this.statuses[userId] !== AuthenticationStatus.Unlocked
    ) {
      return null;
    }
    if (view == null || view.id !== cipherId || view.partial !== false) {
      this.drop(userId, cipherId);
      return null;
    }
    const userEntries = new Map(this.entries$.value.get(userId));
    userEntries.set(cipherId, { view, endsAt: Date.parse(notAfter) });
    this.entries$.next(new Map(this.entries$.value).set(userId, userEntries));
    return view;
  }

  private async readLeasedView(cipherId: CipherId): Promise<CipherView | null> {
    try {
      const view = await this.accessLeaseSdkService.leasedCipher(cipherId);
      return view == null ? null : (CipherView.fromSdkCipherView(view) ?? null);
    } catch (error: unknown) {
      this.logService.error(error);
      return null;
    }
  }

  /** Runs on the shared clock, outside the zone. Re-enters it only to drop a view. */
  private dropLapsed(nowMs: number): void {
    let changed = false;
    const next = new Map<UserId, ReadonlyMap<CipherId, Entry>>();
    this.entries$.value.forEach((entries, userId) => {
      const live = new Map([...entries].filter(([, entry]) => entry.endsAt > nowMs));
      changed ||= live.size !== entries.size;
      next.set(userId, live);
    });
    if (changed) {
      this.ngZone.run(() => this.entries$.next(next));
    }
  }

  private clear(userId: UserId): void {
    this.generations.set(userId, (this.generations.get(userId) ?? 0) + 1);
    if (!this.entries$.value.has(userId)) {
      return;
    }
    const next = new Map(this.entries$.value);
    next.delete(userId);
    this.entries$.next(next);
  }

  private drop(userId: UserId, cipherId: CipherId): void {
    if (!this.entries$.value.get(userId)?.has(cipherId)) {
      return;
    }
    const userEntries = new Map(this.entries$.value.get(userId));
    userEntries.delete(cipherId);
    this.entries$.next(new Map(this.entries$.value).set(userId, userEntries));
  }

  /**
   * The clock ticks outside the zone, but the re-lock rewrites plain component fields on the open
   * dialog, so emissions re-enter it. Applied after `distinctUntilChanged`, so only a change pays.
   */
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
