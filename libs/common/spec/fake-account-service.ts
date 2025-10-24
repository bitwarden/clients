// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { mock } from "jest-mock-extended";
import { ReplaySubject, combineLatest, map, Observable } from "rxjs";

import { Account, AccountInfo, AccountService } from "../src/auth/abstractions/account.service";
import { UserId } from "../src/types/guid";

export function mockAccountServiceWith(
  userId: UserId,
  info: Partial<AccountInfo> = {},
  activity: Record<UserId, Date> = {},
): FakeAccountService {
  const fullInfo: AccountInfo = {
    ...info,
    ...{
      name: "name",
      email: "email",
      emailVerified: true,
    },
  };

  const fullActivity = { [userId]: new Date(), ...activity };

  const service = new FakeAccountService({ [userId]: fullInfo }, fullActivity);
  service.activeAccountSubject.next({ id: userId, ...fullInfo });
  return service;
}

export class FakeAccountService implements AccountService {
  mock = mock<AccountService>();
  // eslint-disable-next-line rxjs/no-exposed-subjects -- test class
  accountsSubject = new ReplaySubject<Record<UserId, AccountInfo>>(1);
  // eslint-disable-next-line rxjs/no-exposed-subjects -- test class
  activeAccountSubject = new ReplaySubject<Account | null>(1);
  // eslint-disable-next-line rxjs/no-exposed-subjects -- test class
  accountActivitySubject = new ReplaySubject<Record<UserId, Date>>(1);
  // eslint-disable-next-line rxjs/no-exposed-subjects -- test class
  accountVerifyDevicesSubject = new ReplaySubject<boolean>(1);
  // eslint-disable-next-line rxjs/no-exposed-subjects -- test class
  showHeaderSubject = new ReplaySubject<boolean>(1);
  private _activeUserId: UserId;
  get activeUserId() {
    return this._activeUserId;
  }
  accounts$ = this.accountsSubject.asObservable();
  activeAccount$ = this.activeAccountSubject.asObservable();
  accountActivity$ = this.accountActivitySubject.asObservable();
  accountVerifyNewDeviceLogin$ = this.accountVerifyDevicesSubject.asObservable();
  get sortedUserIds$() {
    return this.accountActivity$.pipe(
      map((activity) => {
        return Object.entries(activity)
          .map(([userId, lastActive]: [UserId, Date]) => ({ userId, lastActive }))
          .sort((a, b) => a.lastActive.getTime() - b.lastActive.getTime())
          .map((a) => a.userId);
      }),
    );
  }
  showHeader$ = this.showHeaderSubject.asObservable();
  get nextUpAccount$(): Observable<Account> {
    return combineLatest([this.accounts$, this.activeAccount$, this.sortedUserIds$]).pipe(
      map(([accounts, activeAccount, sortedUserIds]) => {
        const nextId = sortedUserIds.find((id) => id !== activeAccount?.id && accounts[id] != null);
        return nextId ? { id: nextId, ...accounts[nextId] } : null;
      }),
    );
  }

  constructor(initialData: Record<UserId, AccountInfo>, accountActivity?: Record<UserId, Date>) {
    this.accountsSubject.next(initialData);
    this.activeAccountSubject.subscribe((data) => (this._activeUserId = data?.id));
    this.activeAccountSubject.next(null);
    this.accountActivitySubject.next(accountActivity);
  }

  setAccountVerifyNewDeviceLogin(userId: UserId, verifyNewDeviceLogin: boolean): Promise<void> {
    return this.mock.setAccountVerifyNewDeviceLogin(userId, verifyNewDeviceLogin);
  }

  setAccountActivity(userId: UserId, lastActivity: Date): Promise<void> {
    this.accountActivitySubject.next({
      ...this.accountActivitySubject["_buffer"][0],
      [userId]: lastActivity,
    });
    return this.mock.setAccountActivity(userId, lastActivity);
  }

  async addAccount(userId: UserId, accountData: AccountInfo): Promise<void> {
    const current = this.accountsSubject["_buffer"][0] ?? {};
    this.accountsSubject.next({ ...current, [userId]: accountData });
    await this.mock.addAccount(userId, accountData);
  }

  async setAccountName(userId: UserId, name: string): Promise<void> {
    await this.mock.setAccountName(userId, name);
  }

  async setAccountEmail(userId: UserId, email: string): Promise<void> {
    await this.mock.setAccountEmail(userId, email);
  }

  async setAccountEmailVerified(userId: UserId, emailVerified: boolean): Promise<void> {
    await this.mock.setAccountEmailVerified(userId, emailVerified);
  }

  async switchAccount(userId: UserId): Promise<void> {
    const next =
      userId == null ? null : { id: userId, ...this.accountsSubject["_buffer"]?.[0]?.[userId] };
    this.activeAccountSubject.next(next);
    await this.mock.switchAccount(userId);
  }

  async clean(userId: UserId): Promise<void> {
    const current = this.accountsSubject["_buffer"][0] ?? {};
    const updated = { ...current, [userId]: loggedOutInfo };
    this.accountsSubject.next(updated);
    await this.mock.clean(userId);
  }

  async setShowHeader(value: boolean): Promise<void> {
    this.showHeaderSubject.next(value);
  }
}

const loggedOutInfo: AccountInfo = {
  name: undefined,
  email: "",
  emailVerified: false,
};
