import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { newGuid } from "@bitwarden/guid";
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import { AccountInfo, AccountService } from "../../auth/abstractions/account.service";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { UserId } from "../../types/guid";
import { UserKey } from "../../types/key";

import { UnlockEventPoller } from "./unlock-state-poll";

describe("UnlockEventPoller", () => {
  let keyService: MockProxy<KeyService>;
  let accountService: MockProxy<AccountService>;
  let accounts$: BehaviorSubject<Record<UserId, AccountInfo>>;
  let onUnlock: jest.Mock<Promise<void>, [UserId, SymmetricCryptoKey]>;
  let poller: UnlockEventPoller;

  const userA = newGuid() as UserId;
  const userB = newGuid() as UserId;
  const keyA = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const keyB = new SymmetricCryptoKey(new Uint8Array(64).fill(1)) as UserKey;

  const accountInfo: AccountInfo = {
    email: "user@example.com",
    emailVerified: true,
    name: undefined,
    creationDate: undefined,
  };

  beforeEach(() => {
    keyService = mock<KeyService>();
    accountService = mock<AccountService>();
    accounts$ = new BehaviorSubject<Record<UserId, AccountInfo>>({});
    Object.defineProperty(accountService, "accounts$", {
      configurable: true,
      get: () => accounts$,
    });
    onUnlock = jest.fn<Promise<void>, [UserId, SymmetricCryptoKey]>().mockResolvedValue(undefined);
    poller = new UnlockEventPoller(keyService, accountService, onUnlock);
  });

  it("fires onUnlock when an account transitions from locked to unlocked across two polls", async () => {
    accounts$.next({ [userA]: accountInfo });
    keyService.userKey$.mockReturnValueOnce(of(null)).mockReturnValueOnce(of(keyA));

    await poller.poll();
    expect(onUnlock).not.toHaveBeenCalled();

    await poller.poll();
    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(onUnlock).toHaveBeenCalledWith(userA, keyA);
  });

  it("does not re-fire on subsequent polls while the account stays unlocked", async () => {
    accounts$.next({ [userA]: accountInfo });
    keyService.userKey$.mockReturnValue(of(keyA));

    for (let i = 0; i < 6; i++) {
      await poller.poll();
    }

    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it("fires again after a relock-then-unlock cycle", async () => {
    accounts$.next({ [userA]: accountInfo });
    keyService.userKey$
      .mockReturnValueOnce(of(null))
      .mockReturnValueOnce(of(keyA))
      .mockReturnValueOnce(of(keyA))
      .mockReturnValueOnce(of(null))
      .mockReturnValueOnce(of(keyA));

    for (let i = 0; i < 5; i++) {
      await poller.poll();
    }

    expect(onUnlock).toHaveBeenCalledTimes(2);
    expect(onUnlock).toHaveBeenNthCalledWith(1, userA, keyA);
    expect(onUnlock).toHaveBeenNthCalledWith(2, userA, keyA);
  });

  it("fires on the first poll if an account is already unlocked when the poller is created", async () => {
    accounts$.next({ [userA]: accountInfo });
    keyService.userKey$.mockReturnValueOnce(of(keyA));

    await poller.poll();

    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(onUnlock).toHaveBeenCalledWith(userA, keyA);
  });

  it("does not fire when an account is locked from the start and stays locked", async () => {
    accounts$.next({ [userA]: accountInfo });
    keyService.userKey$.mockReturnValue(of(null));

    for (let i = 0; i < 10; i++) {
      await poller.poll();
    }

    expect(onUnlock).not.toHaveBeenCalled();
  });

  it("tracks multiple accounts independently", async () => {
    accounts$.next({ [userA]: accountInfo, [userB]: accountInfo });
    keyService.userKey$.mockImplementation((userId: string) => {
      if (userId === userA) {
        return of(null);
      }
      return of(keyB);
    });

    await poller.poll();
    await poller.poll();

    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(onUnlock).toHaveBeenCalledWith(userB, keyB);
  });

  it("clears internal tracking for accounts that disappear from accounts$", async () => {
    accounts$.next({ [userA]: accountInfo });
    keyService.userKey$.mockReturnValue(of(keyA));

    await poller.poll();
    expect(onUnlock).toHaveBeenCalledTimes(1);

    accounts$.next({});
    await poller.poll();
    expect(onUnlock).toHaveBeenCalledTimes(1);

    accounts$.next({ [userA]: accountInfo });
    await poller.poll();
    expect(onUnlock).toHaveBeenCalledTimes(2);
  });
});
