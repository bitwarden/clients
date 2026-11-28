import { inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Params, Router } from "@angular/router";
import { filter, firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import {
  ORGANIZATION_MANAGEMENT_PREFERENCES_DISK,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import { membersFilterScopeOf, rememberableParams } from "./members-filter-scope";

/**
 * Remembered members table params, by organization. Kept across locks so a reload, which lands on
 * the lock screen, can still restore them after unlock.
 */
export const MEMBERS_FILTER_MEMORY = UserKeyDefinition.record<Params, OrganizationId>(
  ORGANIZATION_MANAGEMENT_PREFERENCES_DISK,
  "membersFilterMemory",
  {
    deserializer: (obj) => obj,
    clearOn: ["logout"],
  },
);

/**
 * Remembers the filters, search, sort, and page size each organization's members page was last
 * viewed with, so returning to it puts the user back where they left off.
 *
 * The members table already mirrors that state to the URL, so this stores the URL's own query
 * params on each navigation rather than a second representation of the same state. Restoring is
 * {@link membersFilterRestoreGuard}'s job.
 *
 * Follows the vault's `VaultFilterMemoryService`.
 */
@Injectable({ providedIn: "root" })
export class MembersFilterMemoryService {
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly stateProvider = inject(StateProvider);

  /**
   * The write chain. Reads await it so a read sees the params the last navigation recorded,
   * rather than racing the write that recorded them.
   */
  private pending: Promise<unknown> = Promise.resolve();

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.record());
  }

  /** The remembered params for an organization, or `{}` if its members page hasn't been visited. */
  async paramsFor(organizationId: OrganizationId): Promise<Params> {
    await this.pending;

    const userId = await this.activeUserId();
    if (userId == null) {
      return {};
    }

    const remembered = await firstValueFrom(
      this.stateProvider.getUser(userId, MEMBERS_FILTER_MEMORY).state$,
    );
    return remembered?.[organizationId] ?? {};
  }

  private record(): void {
    const state = this.router.routerState.snapshot;
    const organizationId = membersFilterScopeOf(state);
    if (organizationId == null) {
      return;
    }

    const params = rememberableParams(state.root.queryParams);

    // Resolved from the account active as this navigation ends, not whoever is active when the
    // write lands, so an account switch mid-write can't put one account's filters in another's.
    const recordedFor = this.activeUserId();

    this.pending = this.pending
      .then(async () => {
        const userId = await recordedFor;
        if (userId == null) {
          return;
        }
        await this.stateProvider
          .getUser(userId, MEMBERS_FILTER_MEMORY)
          .update((prev) => ({ ...prev, [organizationId]: params }));
      })
      // A failed write must not poison the chain for every read and write after it.
      .catch((): void => undefined);
  }

  private activeUserId(): Promise<UserId | null> {
    return firstValueFrom(this.accountService.activeAccount$.pipe(getOptionalUserId));
  }
}
