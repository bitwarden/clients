import {
  BehaviorSubject,
  combineLatest,
  concatMap,
  defaultIfEmpty,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  of,
  switchMap,
  timeout,
} from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import { StateProvider } from "@bitwarden/common/platform/state";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { RestrictedCipherPolicy } from "@bitwarden/common/vault/utils/restricted-cipher-policy";

import { PAM_REFRESH_LEASES } from "./lease-messages";
import {
  LEASED_CIPHERS,
  LeasedCipherEntry,
  liveLeasedCiphers,
  liveLeases$,
} from "./leased-cipher.state";

/** How long a reveal waits for the background to write the user's leases. */
const REFRESH_WAIT_MS = 10_000;

/** A revealed view and the end of its lease, in ms. */
type Entry = { view: CipherView; endsAt: number };

/**
 * Serves the leased copies that the background's `PamLeaseRefreshService` keeps in session memory
 * state. Each process decrypts them into its own memory. The worker and the popup each run one.
 */
export class BrowserRevealedCipherService implements RevealedCipherService {
  private readonly entries$ = new BehaviorSubject<
    ReadonlyMap<UserId, ReadonlyMap<CipherId, Entry>>
  >(new Map());

  constructor(
    private readonly stateProvider: StateProvider,
    authService: AuthService,
    private readonly cipherService: CipherService,
    private readonly messageSender: MessageSender,
    private readonly logService: LogService,
  ) {
    // A root singleton, so the subscription never ends. A user who leaves Unlocked drops out here,
    // which clears that user's views in this process; `clearOn` clears the shared copies.
    authService.authStatuses$
      .pipe(
        map(unlockedUserIds),
        distinctUntilChanged((a, b) => a.join() === b.join()),
        switchMap((userIds) =>
          combineLatest(
            userIds.map((userId) =>
              liveLeases$(this.stateProvider, userId).pipe(
                concatMap(async (live) => [userId, await this.decryptAll(userId, live)] as const),
              ),
            ),
          ).pipe(defaultIfEmpty([])),
        ),
      )
      .subscribe((pairs) => this.entries$.next(new Map(pairs)));
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
    await this.requestRefresh(userId, cipherId);
    return this.readView(userId, cipherId);
  }

  async refresh(userId: UserId, cipherId: CipherId): Promise<void> {
    await this.requestRefresh(userId, cipherId);
  }

  displayView$(userId: UserId, storedView: CipherView): Observable<CipherView> {
    if (!RestrictedCipherPolicy.isRestricted(storedView)) {
      return of(storedView);
    }
    return this.revealed$(userId).pipe(
      map((revealed) => revealed.get(storedView.id as CipherId) ?? storedView),
      distinctUntilChanged(),
    );
  }

  /** Asks the background to re-read the leases, then waits for its write or gives up. */
  private async requestRefresh(userId: UserId, cipherId: CipherId): Promise<void> {
    const sentAt = Date.now();
    const written = firstValueFrom(
      this.stateProvider.getUser(userId, LEASED_CIPHERS).state$.pipe(
        filter((state) => (state?.refreshedAt ?? 0) >= sentAt),
        timeout({ first: REFRESH_WAIT_MS, with: () => of(null) }),
      ),
    );
    this.messageSender.send(PAM_REFRESH_LEASES, { userId, cipherId });
    await written;
  }

  /** Reads the copy from state, since the decrypted entries can lag the write by a tick. */
  private async readView(userId: UserId, cipherId: CipherId): Promise<CipherView | null> {
    const state = await firstValueFrom(this.stateProvider.getUser(userId, LEASED_CIPHERS).state$);
    const entry = liveLeasedCiphers(state?.leases, Date.now())[cipherId];
    return entry == null ? null : ((await this.decrypt(userId, cipherId, entry))?.view ?? null);
  }

  private async decryptAll(
    userId: UserId,
    live: Record<string, LeasedCipherEntry>,
  ): Promise<ReadonlyMap<CipherId, Entry>> {
    const entries = await Promise.all(
      Object.entries(live).map(async ([cipherId, entry]) => {
        const decrypted = await this.decrypt(userId, cipherId as CipherId, entry);
        return decrypted == null ? null : ([cipherId as CipherId, decrypted] as const);
      }),
    );
    return new Map(entries.filter((entry) => entry != null));
  }

  /** Only a full view of the requested cipher; anything else is dropped. */
  private async decrypt(
    userId: UserId,
    cipherId: CipherId,
    entry: LeasedCipherEntry,
  ): Promise<Entry | null> {
    try {
      const view = await this.cipherService.decrypt(new Cipher(entry.cipher), userId);
      if (view?.id !== cipherId || view.partial !== false) {
        return null;
      }
      return { view, endsAt: Date.parse(entry.notAfter) };
    } catch (error) {
      this.logService.error(`[PAM] Failed to decrypt a leased cipher: ${error}`);
      return null;
    }
  }
}

function unlockedUserIds(statuses: Record<UserId, AuthenticationStatus>): UserId[] {
  return (Object.keys(statuses ?? {}) as UserId[])
    .filter((userId) => statuses[userId] === AuthenticationStatus.Unlocked)
    .sort();
}
