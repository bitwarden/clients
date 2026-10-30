import { distinctUntilChanged, map, NEVER, Observable, share, skip, switchMap } from "rxjs";

import { AccessEventService } from "@bitwarden/bit-common/pam/abstractions/access-event.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { StateProvider } from "@bitwarden/common/platform/state";

import { LEASED_CIPHERS } from "../leased-cipher.state";

/**
 * The popup hears no pushes, so it ticks when the background rewrites the leased copies, which it
 * does after every push, sync, and lease refresh.
 */
export class BrowserAccessEventService implements AccessEventService {
  private readonly changed$: Observable<void>;

  constructor(stateProvider: StateProvider, accountService: AccountService) {
    this.changed$ = accountService.activeAccount$.pipe(
      getOptionalUserId,
      distinctUntilChanged(),
      switchMap((userId) =>
        userId == null
          ? NEVER
          : stateProvider.getUser(userId, LEASED_CIPHERS).state$.pipe(
              map((state) => state?.refreshedAt),
              distinctUntilChanged(),
              // The stored value on subscribe is not a change.
              skip(1),
            ),
      ),
      map((): void => undefined),
      share(),
    );
  }

  accessChanged$(): Observable<void> {
    return this.changed$;
  }

  /** The popup has no approver surfaces. */
  approverInboxChanged$(): Observable<void> {
    return NEVER;
  }
}
