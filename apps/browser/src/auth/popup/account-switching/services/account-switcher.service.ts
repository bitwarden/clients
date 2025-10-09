// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import {
  Observable,
  combineLatest,
  filter,
  firstValueFrom,
  map,
  switchMap,
  throwError,
  timeout,
} from "rxjs";

import { NewActiveUser } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AvatarService } from "@bitwarden/common/auth/abstractions/avatar.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";

import { fromChromeEvent } from "../../../../platform/browser/from-chrome-event";

export type AvailableAccount = {
  name: string;
  email?: string;
  id: string;
  isActive: boolean;
  server?: string;
  status?: AuthenticationStatus;
  avatarColor?: string;
};

@Injectable({
  providedIn: "root",
})
export class AccountSwitcherService {
  static incompleteAccountSwitchError = "Account switch did not complete.";

  ACCOUNT_LIMIT = 5;
  SPECIAL_ADD_ACCOUNT_ID = "addAccount";
  availableAccounts$: Observable<AvailableAccount[]>;

  switchAccountFinished$: Observable<NewActiveUser | null>;

  constructor(
    private accountService: AccountService,
    private avatarService: AvatarService,
    private messagingService: MessagingService,
    private environmentService: EnvironmentService,
    private logService: LogService,
    authService: AuthService,
  ) {
    this.availableAccounts$ = combineLatest([
      accountService.accounts$,
      authService.authStatuses$,
      this.accountService.activeAccount$,
    ]).pipe(
      switchMap(async ([accounts, accountStatuses, activeAccount]) => {
        const loggedInIds = Object.keys(accounts).filter(
          (id: UserId) => accountStatuses[id] !== AuthenticationStatus.LoggedOut,
        );
        // Accounts shouldn't ever be more than ACCOUNT_LIMIT but just in case do a greater than
        const hasMaxAccounts = loggedInIds.length >= this.ACCOUNT_LIMIT;
        const options: AvailableAccount[] = await Promise.all(
          loggedInIds.map(async (id: UserId) => {
            const userEnv = await firstValueFrom(this.environmentService.getEnvironment$(id));
            return {
              name: accounts[id].name ?? accounts[id].email,
              email: accounts[id].email,
              id: id,
              server: userEnv?.getHostname(),
              status: accountStatuses[id],
              isActive: id === activeAccount?.id,
              avatarColor: await firstValueFrom(
                this.avatarService.getUserAvatarColor$(id as UserId),
              ),
            };
          }),
        );

        if (!hasMaxAccounts) {
          options.push({
            name: "addAccount",
            id: this.SPECIAL_ADD_ACCOUNT_ID,
            isActive: false,
          });
        }

        return options.sort((a, b) => {
          /**
           * Make sure the compare function is "well-formed" to account for browser inconsistencies.
           *
           * For specifics, see the sections "Description" and "Sorting with a non-well-formed comparator"
           * on this page:
           * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
           */

          // Active account (if one exists) is always first
          if (a.isActive) {
            return -1;
          }

          // If account "b" is the 'Add account' button, keep original order of "a" and "b"
          if (b.id === this.SPECIAL_ADD_ACCOUNT_ID) {
            return 0;
          }

          return 1;
        });
      }),
    );

    // Create a reusable observable that listens to the switchAccountFinish message and returns the userId from the message
    this.switchAccountFinished$ = fromChromeEvent<
      [message: { command: string; userId: UserId; status: AuthenticationStatus }]
    >(chrome.runtime.onMessage).pipe(
      filter(([message]) => message.command === "switchAccountFinish"),
      map(([message]) => ({ userId: message.userId, authenticationStatus: message.status })),
    );
  }

  get specialAccountAddId() {
    return this.SPECIAL_ADD_ACCOUNT_ID;
  }

  async selectAccount(id: string) {
    if (id === this.SPECIAL_ADD_ACCOUNT_ID) {
      id = null;
    }
    const userId = id as UserId;

    // Creates a subscription to the switchAccountFinished observable but further
    // filters it to only care about the current userId.
    const switchAccountFinishedPromise = this.listenForSwitchAccountFinish(userId);

    // Initiate the actions required to make account switching happen
    this.messagingService.send("switchAccount", { userId }); // This message should cause switchAccountFinish to be sent

    // Wait until we receive the switchAccountFinished message
    return await switchAccountFinishedPromise;
  }

  // Listens for the switchAccountFinish message and returns the userId from the message
  // Optionally filters switchAccountFinish to an expected userId
  listenForSwitchAccountFinish(expectedUserId: UserId | null): Promise<NewActiveUser | null> {
    return firstValueFrom(
      this.switchAccountFinished$.pipe(
        filter(({ userId }) => (expectedUserId ? userId === expectedUserId : true)),
        timeout({
          // Much longer than account switching is expected to take for normal accounts
          // but the account switching process includes a possible full sync so we need to account
          // for very large accounts and want to still have a timeout
          // to avoid a promise that might never resolve/reject
          first: 60_000,
          with: () =>
            throwError(() => new Error(AccountSwitcherService.incompleteAccountSwitchError)),
        }),
      ),
    ).catch((err): any => {
      if (
        err instanceof Error &&
        err.message === AccountSwitcherService.incompleteAccountSwitchError
      ) {
        this.logService.warning("message 'switchAccount' never responded.");
        return null;
      }
      throw err;
    });
  }
}
