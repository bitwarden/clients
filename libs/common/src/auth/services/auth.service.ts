// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  Observable,
  combineLatest,
  distinctUntilChanged,
  firstValueFrom,
  map,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import { ApiService } from "../../abstractions/api.service";
import { StateService } from "../../platform/abstractions/state.service";
import { MessageSender } from "../../platform/messaging";
import { Utils } from "../../platform/misc/utils";
import { UserId } from "../../types/guid";
import { AccountService } from "../abstractions/account.service";
import { AuthService as AuthServiceAbstraction } from "../abstractions/auth.service";
import { TokenService } from "../abstractions/token.service";
import { AuthenticationStatus } from "../enums/authentication-status";

export class AuthService implements AuthServiceAbstraction {
  activeAccountStatus$: Observable<AuthenticationStatus>;
  authStatuses$: Observable<Record<UserId, AuthenticationStatus>>;

  constructor(
    protected accountService: AccountService,
    protected messageSender: MessageSender,
    protected keyService: KeyService,
    protected apiService: ApiService,
    protected stateService: StateService,
    private tokenService: TokenService,
  ) {
    this.activeAccountStatus$ = this.accountService.activeAccount$.pipe(
      map((account) => account?.id),
      switchMap((userId) => {
        return this.authStatusFor$(userId);
      }),
    );

    this.authStatuses$ = this.accountService.accounts$.pipe(
      map((accounts) => Object.keys(accounts) as UserId[]),
      switchMap((entries) => {
        if (entries.length === 0) {
          return of([] as { userId: UserId; status: AuthenticationStatus }[]);
        }
        return combineLatest(
          entries.map((userId) =>
            this.authStatusFor$(userId).pipe(map((status) => ({ userId, status }))),
          ),
        );
      }),
      map((statuses) => {
        return statuses.reduce(
          (acc, { userId, status }) => {
            acc[userId] = status;
            return acc;
          },
          {} as Record<UserId, AuthenticationStatus>,
        );
      }),
    );
  }

  authStatusFor$(userId: UserId): Observable<AuthenticationStatus> {
    if (!Utils.isGuid(userId)) {
      return of(AuthenticationStatus.LoggedOut);
    }

    return combineLatest([
      this.keyService.getInMemoryUserKeyFor$(userId),
      this.tokenService.hasAccessToken$(userId),
    ]).pipe(
      map(([userKey, hasAccessToken]) => {
        if (!hasAccessToken) {
          return AuthenticationStatus.LoggedOut;
        }

        if (!userKey) {
          return AuthenticationStatus.Locked;
        }

        return AuthenticationStatus.Unlocked;
      }),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }

  async getAuthStatus(userId?: string): Promise<AuthenticationStatus> {
    userId ??= await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.id)));
    return await firstValueFrom(this.authStatusFor$(userId as UserId));
  }

  logOut(callback: () => void, userId?: string): void {
    callback();
    this.messageSender.send("loggedOut", { userId });
  }
}
