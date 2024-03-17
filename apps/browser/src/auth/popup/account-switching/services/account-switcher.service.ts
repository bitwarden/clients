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

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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

  switchAccountFinished$: Observable<string>;

  constructor(
    private accountService: AccountService,
    private avatarService: AvatarService,
    private messagingService: MessagingService,
    private environmentService: EnvironmentService,
    private logService: LogService,
  ) {
    this.availableAccounts$ = combineLatest([
      this.accountService.accounts$,
      this.accountService.activeAccount$,
    ]).pipe(
      switchMap(async ([accounts, activeAccount]) => {
        const accountEntries = Object.entries(accounts).filter(
          ([_, account]) => account.status !== AuthenticationStatus.LoggedOut,
        );
        // Accounts shouldn't ever be more than ACCOUNT_LIMIT but just in case do a greater than
        const hasMaxAccounts = accountEntries.length >= this.ACCOUNT_LIMIT;
        const options: AvailableAccount[] = await Promise.all(
          accountEntries.map(async ([id, account]) => {
            return {
              name: account.name ?? account.email,
              email: account.email,
              id: id,
              server: await this.environmentService.getHost(id),
              status: account.status,
              isActive: id === activeAccount?.id,
              avatarColor: await firstValueFrom(
                this.avatarService.getUserAvatarColor$(id as UserId),
              ),
            };
          }),
        );

        if (!hasMaxAccounts) {
          options.push({
            name: "Add account",
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

    // Create a reusable observable that listens to the the switchAccountFinish message and returns the userId from the message
    this.switchAccountFinished$ = fromChromeEvent<[message: { command: string; userId: string }]>(
      chrome.runtime.onMessage,
    ).pipe(
      filter(([message]) => message.command === "switchAccountFinish"),
      map(([message]) => message.userId),
    );
  }

  get specialAccountAddId() {
    return this.SPECIAL_ADD_ACCOUNT_ID;
  }

  async selectAccount(id: string) {
    if (id === this.SPECIAL_ADD_ACCOUNT_ID) {
      id = null;
    }

    // Creates a subscription to the switchAccountFinished observable but further
    // filters it to only care about the current userId.
    const switchAccountFinishedPromise = firstValueFrom(
      this.switchAccountFinished$.pipe(
        filter((userId) => userId === id),
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
    );

    // Initiate the actions required to make account switching happen
    await this.accountService.switchAccount(id as UserId);
    this.messagingService.send("switchAccount", { userId: id }); // This message should cause switchAccountFinish to be sent

    // Wait until we recieve the switchAccountFinished message
    await switchAccountFinishedPromise.catch((err) => {
      if (
        err instanceof Error &&
        err.message === AccountSwitcherService.incompleteAccountSwitchError
      ) {
        this.logService.warning("message 'switchAccount' never responded.");
        return;
      }
      throw err;
    });
  }
}
