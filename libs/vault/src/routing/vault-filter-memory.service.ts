import { inject, Injectable } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Params, Router } from "@angular/router";
import { filter, firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import {
  StateProvider,
  UserKeyDefinition,
  VAULT_FILTER_DISK,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { rememberableParams, VaultScope, vaultScopeOf } from "./vault-scope";

/**
 * Remembered vault filters, by scope. Kept across locks so that returning to the vault the next
 * day restores the filters from the day before — on web an unlock is the start of most sessions,
 * so clearing here would leave nothing to restore.
 */
export const VAULT_FILTER_MEMORY = UserKeyDefinition.record<Params>(
  VAULT_FILTER_DISK,
  "vaultFilterMemory",
  {
    deserializer: (obj) => obj,
    clearOn: ["logout"],
  },
);

/**
 * Remembers the filters each vault route was last viewed with, so returning to a vault can put the
 * user back where they left off.
 *
 * The vault table already mirrors its chips and sort to the URL, so this stores the URL's own
 * query params rather than a second representation of the same state — see
 * {@link rememberableParams} for which ones, and {@link vaultScopeOf} for how a route resolves to a
 * scope. Recording happens on navigation, which the table's URL sync triggers on every chip
 * change, so the memory keeps up without the table knowing it exists.
 *
 * Restoring is the caller's job: await {@link paramsFor} and build the URL with them.
 */
@Injectable({ providedIn: "root" })
export class VaultFilterMemoryService {
  private readonly router = inject(Router);
  private readonly accountService = inject(AccountService);
  private readonly stateProvider = inject(StateProvider);

  /**
   * The write chain. Reads await it so a scope switch sees the filters the scope it just left was
   * recorded with, rather than racing the write that recorded them.
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

  /** The remembered filter params for a scope, or `{}` if it hasn't been visited. */
  async paramsFor(scope: VaultScope): Promise<Params> {
    await this.pending;

    const userId = await this.activeUserId();
    if (userId == null) {
      return {};
    }

    const remembered = await firstValueFrom(
      this.stateProvider.getUser(userId, VAULT_FILTER_MEMORY).state$,
    );
    return remembered?.[scope] ?? {};
  }

  private record(): void {
    const state = this.router.routerState.snapshot;
    const scope = vaultScopeOf(state);
    if (scope == null) {
      return;
    }

    const params = rememberableParams(state.root.queryParams);

    // Resolved from the account active as this navigation ends, not from whoever is active when
    // the write lands. `getActive` would do the latter, and mid-switch that writes one account's
    // filters into another's state.
    const recordedFor = this.activeUserId();

    this.pending = this.pending
      .then(async () => {
        const userId = await recordedFor;
        if (userId == null) {
          return;
        }
        await this.stateProvider
          .getUser(userId, VAULT_FILTER_MEMORY)
          .update((prev) => ({ ...prev, [scope]: params }));
      })
      // A failed write must not poison the chain for every read and write after it.
      .catch((): void => undefined);
  }

  private activeUserId(): Promise<UserId | null> {
    return firstValueFrom(this.accountService.activeAccount$.pipe(getOptionalUserId));
  }
}
