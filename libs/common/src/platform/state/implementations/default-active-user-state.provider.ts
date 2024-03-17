import { Observable, distinctUntilChanged, map } from "rxjs";

import { AccountService } from "../../../auth/abstractions/account.service";
import { UserId } from "../../../types/guid";
import { KeyDefinition } from "../key-definition";
import { UserKeyDefinition, isUserKeyDefinition } from "../user-key-definition";
import { ActiveUserState } from "../user-state";
import { ActiveUserStateProvider, SingleUserStateProvider } from "../user-state.provider";

import { DefaultActiveUserState } from "./default-active-user-state";

export class DefaultActiveUserStateProvider implements ActiveUserStateProvider {
  activeUserId$: Observable<UserId | undefined>;

  constructor(
    private readonly accountService: AccountService,
    private readonly singleUserStateProvider: SingleUserStateProvider,
  ) {
    this.activeUserId$ = this.accountService.activeAccount$.pipe(
      map((account) => account?.id),
      // To avoid going to storage when we don't need to, only get updates when there is a true change.
      distinctUntilChanged((a, b) => (a == null || b == null ? a == b : a === b)), // Treat null and undefined as equal
    );
  }

  get<T>(keyDefinition: KeyDefinition<T> | UserKeyDefinition<T>): ActiveUserState<T> {
    if (!isUserKeyDefinition(keyDefinition)) {
      keyDefinition = UserKeyDefinition.fromBaseKeyDefinition(keyDefinition);
    }

    // All other providers cache the creation of their corresponding `State` objects, this instance
    // doesn't need to do that since it calls `SingleUserStateProvider` it will go through their caching
    // layer, because of that, the creation of this instance is quite simple and not worth caching.
    return new DefaultActiveUserState(
      keyDefinition,
      this.activeUserId$,
      this.singleUserStateProvider,
    );
  }
}
