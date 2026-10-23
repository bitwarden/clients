import { Injectable, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Observable, map, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import {
  StateProvider,
  UserKeyDefinition,
  VAULT_PINNED_SHARED_FOLDERS_DISK,
} from "@bitwarden/common/platform/state";
import { CollectionId, UserId } from "@bitwarden/common/types/guid";

/**
 * The shared folders the user pinned to the side nav, in the order they were pinned. Ids only,
 * and kept per device: pins never sync. They outlive lock and logout, like the other dismissal
 * flags, so `clearOn` is empty.
 */
export const PINNED_SHARED_FOLDERS_KEY = UserKeyDefinition.array<CollectionId>(
  VAULT_PINNED_SHARED_FOLDERS_DISK,
  "pinnedSharedFolders",
  {
    deserializer: (id) => id,
    clearOn: [],
  },
);

/**
 * Whether the user closed the Pinned section's empty state, or has pinned a folder. One flag per
 * user, not per organization.
 */
export const PINNED_EMPTY_STATE_DISMISSED_KEY = new UserKeyDefinition<boolean>(
  VAULT_PINNED_SHARED_FOLDERS_DISK,
  "pinnedEmptyStateDismissed",
  {
    deserializer: (value) => value,
    clearOn: [],
  },
);

/**
 * Owns which shared folders the user pinned to the side nav, and whether the Pinned section's
 * empty state has been dismissed.
 *
 * Ids that no longer resolve to a folder are left in storage: the nav hides them at render time,
 * so a folder that is briefly unavailable (a sync in flight, access revoked and later restored)
 * comes back still pinned.
 */
@Injectable({ providedIn: "root" })
export class PinnedSharedFoldersService {
  private readonly stateProvider = inject(StateProvider);
  private readonly accountService = inject(AccountService);

  /** The pinned folder ids, in pin order. */
  pinnedIds$(userId: UserId): Observable<CollectionId[]> {
    return this.stateProvider
      .getUser(userId, PINNED_SHARED_FOLDERS_KEY)
      .state$.pipe(map((ids) => ids ?? []));
  }

  /**
   * The active user's pinned folder ids, as a signal — the composition every consumer otherwise
   * re-derives (`activeAccount$` into {@link pinnedIds$} into `toSignal`).
   *
   * Resolves to `[]` rather than using `getUserId` while no account is active (e.g. between
   * `switchAccount(null)` and a new account finishing login) — this is a `providedIn: "root"`
   * singleton, so a thrown error here would permanently end its subscription for the rest of the
   * app session, unlike a component-scoped equivalent that gets torn down and recreated.
   */
  readonly activePinnedIds = toSignal(
    this.accountService.activeAccount$.pipe(
      switchMap((account) =>
        account == null ? of([] as CollectionId[]) : this.pinnedIds$(account.id),
      ),
    ),
    { initialValue: [] as CollectionId[] },
  );

  /** Whether the Pinned section's empty state has been dismissed. */
  emptyStateDismissed$(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUser(userId, PINNED_EMPTY_STATE_DISMISSED_KEY)
      .state$.pipe(map((dismissed) => dismissed ?? false));
  }

  /**
   * Pins a folder. Pinning also dismisses the empty state for good, so unpinning the last folder
   * never brings it back.
   */
  async pin(userId: UserId, collectionId: CollectionId): Promise<void> {
    await this.stateProvider
      .getUser(userId, PINNED_SHARED_FOLDERS_KEY)
      .update((ids) => (ids?.includes(collectionId) ? ids : [...(ids ?? []), collectionId]));
    await this.dismissEmptyState(userId);
  }

  async unpin(userId: UserId, collectionId: CollectionId): Promise<void> {
    await this.stateProvider
      .getUser(userId, PINNED_SHARED_FOLDERS_KEY)
      .update((ids) => (ids ?? []).filter((id) => id !== collectionId));
  }

  async dismissEmptyState(userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, PINNED_EMPTY_STATE_DISMISSED_KEY).update(() => true);
  }
}
