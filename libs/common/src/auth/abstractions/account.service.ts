import { Observable } from "rxjs";

import { UserId } from "../../types/guid";

/**
 * Holds information about an account for use in the AccountService
 * if more information is added, be sure to update the equality method.
 */
export type AccountInfo = {
  email: string;
  emailVerified: boolean;
  name: string | undefined;
};

export type Account = { id: UserId } & AccountInfo;

export function accountInfoEqual(a: AccountInfo, b: AccountInfo) {
  if (a == null && b == null) {
    return true;
  }

  if (a == null || b == null) {
    return false;
  }

  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof AccountInfo>;
  for (const key of keys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

export abstract class AccountService {
  abstract accounts$: Observable<Record<UserId, AccountInfo>>;

  abstract activeAccount$: Observable<Account | null>;

  /**
   * Observable of the last activity time for each account.
   */
  abstract accountActivity$: Observable<Record<UserId, Date>>;
  /** Observable of the new device login verification property for the account. */
  abstract accountVerifyNewDeviceLogin$: Observable<boolean>;
  /** Account list in order of descending recency */
  abstract sortedUserIds$: Observable<UserId[]>;
  /** Next account that is not the current active account */
  abstract nextUpAccount$: Observable<Account>;
  /** Observable to display the header */
  abstract showHeader$: Observable<boolean>;
  /**
   * Updates the `accounts$` observable with the new account data.
   *
   * @note Also sets the last active date of the account to `now`.
   * @param userId
   * @param accountData
   */
  abstract addAccount(userId: UserId, accountData: AccountInfo): Promise<void>;
  /**
   * updates the `accounts$` observable with the new preferred name for the account.
   * @param userId
   * @param name
   */
  abstract setAccountName(userId: UserId, name: string): Promise<void>;
  /**
   * updates the `accounts$` observable with the new email for the account.
   * @param userId
   * @param email
   */
  abstract setAccountEmail(userId: UserId, email: string): Promise<void>;
  /**
   * updates the `accounts$` observable with the new email verification status for the account.
   * @param userId
   * @param emailVerified
   */
  abstract setAccountEmailVerified(userId: UserId, emailVerified: boolean): Promise<void>;
  /**
   * updates the `accounts$` observable with the new VerifyNewDeviceLogin property for the account.
   * @param userId
   * @param VerifyNewDeviceLogin
   */
  abstract setAccountVerifyNewDeviceLogin(
    userId: UserId,
    verifyNewDeviceLogin: boolean,
  ): Promise<void>;
  /**
   * Updates the `activeAccount$` observable with the new active account.
   * @param userId
   */
  abstract switchAccount(userId: UserId | null): Promise<void>;
  /**
   * Cleans personal information for the given account from the `accounts$` observable. Does not remove the userId from the observable.
   *
   * @note Also sets the last active date of the account to `null`.
   * @param userId
   */
  abstract clean(userId: UserId): Promise<void>;
  /**
   * Updates the given user's last activity time.
   * @param userId
   * @param lastActivity
   */
  abstract setAccountActivity(userId: UserId, lastActivity: Date): Promise<void>;
  /**
   * Show the account switcher.
   * @param value
   */
  abstract setShowHeader(visible: boolean): Promise<void>;
}

export abstract class InternalAccountService extends AccountService {
  abstract delete(): void;
}
