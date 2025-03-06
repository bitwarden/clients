/**
 * need to update test environment so structuredClone works appropriately
 * @jest-environment ../../libs/shared/test.environment.ts
 */

import { MockProxy, mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { FakeGlobalState } from "../../../spec/fake-state";
import {
  FakeGlobalStateProvider,
  FakeSingleUserStateProvider,
} from "../../../spec/fake-state-provider";
import { trackEmissions } from "../../../spec/utils";
import { LogService } from "../../platform/abstractions/log.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { Utils } from "../../platform/misc/utils";
import { UserId } from "../../types/guid";
import { AccountInfo, accountInfoEqual } from "../abstractions/account.service";

import {
  ACCOUNT_ACCOUNTS,
  ACCOUNT_ACTIVE_ACCOUNT_ID,
  ACCOUNT_ACTIVITY,
  ACCOUNT_VERIFY_NEW_DEVICE_LOGIN,
  AccountServiceImplementation,
} from "./account.service";

describe("accountInfoEqual", () => {
  const accountInfo: AccountInfo = { name: "name", email: "email", emailVerified: true };

  it("compares nulls", () => {
    expect(accountInfoEqual(null, null)).toBe(true);
    expect(accountInfoEqual(null, accountInfo)).toBe(false);
    expect(accountInfoEqual(accountInfo, null)).toBe(false);
  });

  it("compares all keys, not just those defined in AccountInfo", () => {
    const different = { ...accountInfo, extra: "extra" };

    expect(accountInfoEqual(accountInfo, different)).toBe(false);
  });

  it("compares name", () => {
    const same = { ...accountInfo };
    const different = { ...accountInfo, name: "name2" };

    expect(accountInfoEqual(accountInfo, same)).toBe(true);
    expect(accountInfoEqual(accountInfo, different)).toBe(false);
  });

  it("compares email", () => {
    const same = { ...accountInfo };
    const different = { ...accountInfo, email: "email2" };

    expect(accountInfoEqual(accountInfo, same)).toBe(true);
    expect(accountInfoEqual(accountInfo, different)).toBe(false);
  });

  it("compares emailVerified", () => {
    const same = { ...accountInfo };
    const different = { ...accountInfo, emailVerified: false };

    expect(accountInfoEqual(accountInfo, same)).toBe(true);
    expect(accountInfoEqual(accountInfo, different)).toBe(false);
  });
});

describe("accountService", () => {
  let messagingService: MockProxy<MessagingService>;
  let logService: MockProxy<LogService>;
  let globalStateProvider: FakeGlobalStateProvider;
  let singleUserStateProvider: FakeSingleUserStateProvider;
  let sut: AccountServiceImplementation;
  let accountsState: FakeGlobalState<Record<UserId, AccountInfo>>;
  let activeAccountIdState: FakeGlobalState<UserId>;
  let accountActivityState: FakeGlobalState<Record<UserId, Date>>;
  const userId = Utils.newGuid() as UserId;
  const userInfo = { email: "email", name: "name", emailVerified: true };

  beforeEach(() => {
    messagingService = mock();
    logService = mock();
    globalStateProvider = new FakeGlobalStateProvider();
    singleUserStateProvider = new FakeSingleUserStateProvider();

    sut = new AccountServiceImplementation(
      messagingService,
      logService,
      globalStateProvider,
      singleUserStateProvider,
    );

    accountsState = globalStateProvider.getFake(ACCOUNT_ACCOUNTS);
    activeAccountIdState = globalStateProvider.getFake(ACCOUNT_ACTIVE_ACCOUNT_ID);
    accountActivityState = globalStateProvider.getFake(ACCOUNT_ACTIVITY);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("activeAccount$", () => {
    it("should emit null if no account is active", () => {
      const emissions = trackEmissions(sut.activeAccount$);

      expect(emissions).toEqual([null]);
    });

    it("should emit the active account", async () => {
      const emissions = trackEmissions(sut.activeAccount$);
      accountsState.stateSubject.next({ [userId]: userInfo });
      activeAccountIdState.stateSubject.next(userId);

      expect(emissions).toEqual([
        null, // initial value
        { id: userId, ...userInfo },
      ]);
    });

    it("should remember the last emitted value", async () => {
      accountsState.stateSubject.next({ [userId]: userInfo });
      activeAccountIdState.stateSubject.next(userId);

      expect(await firstValueFrom(sut.activeAccount$)).toEqual({
        id: userId,
        ...userInfo,
      });
    });
  });

  describe("accounts$", () => {
    it("should maintain an accounts cache", async () => {
      accountsState.stateSubject.next({ [userId]: userInfo });
      accountsState.stateSubject.next({ [userId]: userInfo });
      expect(await firstValueFrom(sut.accounts$)).toEqual({
        [userId]: userInfo,
      });
    });
  });

  describe("accountsVerifyNewDeviceLogin$", () => {
    it("returns expected value", async () => {
      // Arrange
      const expected = true;
      // we need to set this state since it is how we initialize the VerifyNewDeviceLogin$
      activeAccountIdState.stateSubject.next(userId);
      singleUserStateProvider.getFake(userId, ACCOUNT_VERIFY_NEW_DEVICE_LOGIN).nextState(expected);

      // Act
      const result = await firstValueFrom(sut.accountVerifyNewDeviceLogin$);

      // Assert
      expect(result).toEqual(expected);
    });
  });

  describe("addAccount", () => {
    it("should emit the new account", async () => {
      await sut.addAccount(userId, userInfo);
      const currentValue = await firstValueFrom(sut.accounts$);

      expect(currentValue).toEqual({ [userId]: userInfo });
    });

    it("sets the last active date of the account to now", async () => {
      const state = globalStateProvider.getFake(ACCOUNT_ACTIVITY);
      state.stateSubject.next({});
      await sut.addAccount(userId, userInfo);

      expect(state.nextMock).toHaveBeenCalledWith({ [userId]: expect.any(Date) });
    });

    it.each([null, undefined, 123, "not a guid"])(
      "does not set last active if the userId is not a valid guid",
      async (userId) => {
        const state = globalStateProvider.getFake(ACCOUNT_ACTIVITY);
        state.stateSubject.next({});
        await expect(sut.addAccount(userId as UserId, userInfo)).rejects.toThrow(
          "userId is required",
        );
      },
    );
  });

  describe("setAccountName", () => {
    const initialState = { [userId]: userInfo };
    beforeEach(() => {
      accountsState.stateSubject.next(initialState);
    });

    it("should update the account", async () => {
      await sut.setAccountName(userId, "new name");
      const currentState = await firstValueFrom(accountsState.state$);

      expect(currentState).toEqual({
        [userId]: { ...userInfo, name: "new name" },
      });
    });

    it("should not update if the name is the same", async () => {
      await sut.setAccountName(userId, "name");
      const currentState = await firstValueFrom(accountsState.state$);

      expect(currentState).toEqual(initialState);
    });
  });

  describe("setAccountEmail", () => {
    const initialState = { [userId]: userInfo };
    beforeEach(() => {
      accountsState.stateSubject.next(initialState);
    });

    it("should update the account", async () => {
      await sut.setAccountEmail(userId, "new email");
      const currentState = await firstValueFrom(accountsState.state$);

      expect(currentState).toEqual({
        [userId]: { ...userInfo, email: "new email" },
      });
    });

    it("should not update if the email is the same", async () => {
      await sut.setAccountEmail(userId, "email");
      const currentState = await firstValueFrom(accountsState.state$);

      expect(currentState).toEqual(initialState);
    });
  });

  describe("setAccountEmailVerified", () => {
    const initialState = { [userId]: userInfo };
    initialState[userId].emailVerified = false;
    beforeEach(() => {
      accountsState.stateSubject.next(initialState);
    });

    it("should update the account", async () => {
      await sut.setAccountEmailVerified(userId, true);
      const currentState = await firstValueFrom(accountsState.state$);

      expect(currentState).toEqual({
        [userId]: { ...userInfo, emailVerified: true },
      });
    });

    it("should not update if the email is the same", async () => {
      await sut.setAccountEmailVerified(userId, false);
      const currentState = await firstValueFrom(accountsState.state$);

      expect(currentState).toEqual(initialState);
    });
  });

  describe("setAccountVerifyNewDeviceLogin", () => {
    const initialState = true;
    beforeEach(() => {
      activeAccountIdState.stateSubject.next(userId);
      singleUserStateProvider
        .getFake(userId, ACCOUNT_VERIFY_NEW_DEVICE_LOGIN)
        .nextState(initialState);
    });

    it("should update the VerifyNewDeviceLogin", async () => {
      const expected = false;
      expect(await firstValueFrom(sut.accountVerifyNewDeviceLogin$)).toEqual(initialState);

      await sut.setAccountVerifyNewDeviceLogin(userId, expected);
      const currentState = await firstValueFrom(sut.accountVerifyNewDeviceLogin$);

      expect(currentState).toEqual(expected);
    });

    it("should NOT update VerifyNewDeviceLogin when userId is null", async () => {
      await sut.setAccountVerifyNewDeviceLogin(null, false);
      const currentState = await firstValueFrom(sut.accountVerifyNewDeviceLogin$);

      expect(currentState).toEqual(initialState);
    });
  });

  describe("clean", () => {
    beforeEach(() => {
      accountsState.stateSubject.next({ [userId]: userInfo });
    });

    it("removes account info of the given user", async () => {
      await sut.clean(userId);
      const currentState = await firstValueFrom(accountsState.state$);

      expect(currentState).toEqual({
        [userId]: {
          email: "",
          emailVerified: false,
          name: undefined,
        },
      });
    });

    it("removes account activity of the given user", async () => {
      const state = globalStateProvider.getFake(ACCOUNT_ACTIVITY);
      state.stateSubject.next({ [userId]: new Date() });

      await sut.clean(userId);

      expect(state.nextMock).toHaveBeenCalledWith({});
    });
  });

  describe("switchAccount", () => {
    beforeEach(() => {
      accountsState.stateSubject.next({ [userId]: userInfo });
      activeAccountIdState.stateSubject.next(userId);
      accountActivityState.stateSubject.next({ [userId]: new Date(1) });
    });

    it("should emit null if no account is provided", async () => {
      await sut.switchAccount(null);
      const currentState = await firstValueFrom(sut.activeAccount$);
      expect(currentState).toBeNull();
    });

    it("should throw if the account does not exist", () => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      expect(sut.switchAccount("unknown" as UserId)).rejects.toThrowError("Account does not exist");
    });

    it("should change active account when switched to the new account", async () => {
      const newUserId = Utils.newGuid() as UserId;
      accountsState.stateSubject.next({ [newUserId]: userInfo });

      await sut.switchAccount(newUserId);

      await expect(firstValueFrom(sut.activeAccount$)).resolves.toEqual({
        id: newUserId,
        ...userInfo,
      });
      await expect(firstValueFrom(sut.accountActivity$)).resolves.toEqual({
        [userId]: new Date(1),
        [newUserId]: expect.toAlmostEqual(new Date(), 1000),
      });
    });

    it("should not change active account when already switched to the same account", async () => {
      await sut.switchAccount(userId);

      await expect(firstValueFrom(sut.activeAccount$)).resolves.toEqual({
        id: userId,
        ...userInfo,
      });
      await expect(firstValueFrom(sut.accountActivity$)).resolves.toEqual({
        [userId]: new Date(1),
      });
    });
  });

  describe("account activity", () => {
    let state: FakeGlobalState<Record<UserId, Date>>;

    beforeEach(() => {
      state = globalStateProvider.getFake(ACCOUNT_ACTIVITY);
    });
    describe("accountActivity$", () => {
      it("returns the account activity state", async () => {
        state.stateSubject.next({
          [toId("user1")]: new Date(1),
          [toId("user2")]: new Date(2),
        });

        await expect(firstValueFrom(sut.accountActivity$)).resolves.toEqual({
          [toId("user1")]: new Date(1),
          [toId("user2")]: new Date(2),
        });
      });

      it("returns an empty object when account activity is null", async () => {
        state.stateSubject.next(null);

        await expect(firstValueFrom(sut.accountActivity$)).resolves.toEqual({});
      });
    });

    describe("sortedUserIds$", () => {
      it("returns the sorted user ids by date with most recent first", async () => {
        state.stateSubject.next({
          [toId("user1")]: new Date(3),
          [toId("user2")]: new Date(2),
          [toId("user3")]: new Date(1),
        });

        await expect(firstValueFrom(sut.sortedUserIds$)).resolves.toEqual([
          "user1" as UserId,
          "user2" as UserId,
          "user3" as UserId,
        ]);
      });

      it("returns an empty array when account activity is null", async () => {
        state.stateSubject.next(null);

        await expect(firstValueFrom(sut.sortedUserIds$)).resolves.toEqual([]);
      });
    });

    describe("setAccountActivity", () => {
      const userId = Utils.newGuid() as UserId;
      it("sets the account activity", async () => {
        await sut.setAccountActivity(userId, new Date(1));

        expect(state.nextMock).toHaveBeenCalledWith({ [userId]: new Date(1) });
      });

      it("does not update if the activity is the same", async () => {
        state.stateSubject.next({ [userId]: new Date(1) });

        await sut.setAccountActivity(userId, new Date(1));

        expect(state.nextMock).not.toHaveBeenCalled();
      });

      it.each([null, undefined, 123, "not a guid"])(
        "does not set last active if the userId is not a valid guid",
        async (userId) => {
          await sut.setAccountActivity(userId as UserId, new Date(1));

          expect(state.nextMock).not.toHaveBeenCalled();
        },
      );
    });
  });
});

function toId(userId: string) {
  return userId as UserId;
}
