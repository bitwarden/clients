import { Observable } from "rxjs";

import { UserId } from "../../types/guid";
import { AuthenticationStatus } from "../enums/authentication-status";

/**
 * Holds information about an account for use in the AccountService
 * if more information is added, be sure to update the equality method.
 */
export type AccountInfo = {
  status: AuthenticationStatus;
  email: string;
  name: string | undefined;
};

export function accountInfoEqual(a: AccountInfo, b: AccountInfo) {
  return a?.status === b?.status && a?.email === b?.email && a?.name === b?.name;
}

export abstract class AccountService {
  accounts$: Observable<Record<UserId, AccountInfo>>;
  activeAccount$: Observable<{ id: UserId | undefined } & AccountInfo>;
  accountLock$: Observable<UserId>;
  accountLogout$: Observable<UserId>;
  /**
   * Updates the `accounts$` observable with the new account data.
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
   * Updates the `accounts$` observable with the new account status.
   * Also emits the `accountLock$` or `accountLogout$` observable if the status is `Locked` or `LoggedOut` respectively.
   * @param userId
   * @param status
   */
  abstract setAccountStatus(userId: UserId, status: AuthenticationStatus): Promise<void>;
  /**
   * Updates the `accounts$` observable with the new account status if the current status is higher than the `maxStatus`.
   *
   * This method only downgrades status to the maximum value sent in, it will not increase authentication status.
   *
   * @example An account is transitioning from unlocked to logged out. If callbacks that set the status to locked occur
   * after it is updated to logged out, the account will be in the incorrect state.
   * @param userId The user id of the account to be updated.
   * @param maxStatus The new status of the account.
   */
  abstract setMaxAccountStatus(userId: UserId, maxStatus: AuthenticationStatus): Promise<void>;
  /**
   * Updates the `activeAccount$` observable with the new active account.
   * @param userId
   */
  abstract switchAccount(userId: UserId): Promise<void>;
}

export abstract class InternalAccountService extends AccountService {
  abstract delete(): void;
}
