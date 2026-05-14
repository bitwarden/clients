import { firstValueFrom } from "rxjs";

import { V2UpgradeToken } from "@bitwarden/sdk-internal";

import { FakeAccountService, FakeStateProvider, mockAccountServiceWith } from "../../../../spec";
import { UserId } from "../../../types/guid";
import { V2_UPGRADE_TOKEN } from "../v2-upgrade-token.state";

import { DefaultV2UpgradeTokenStateService } from "./default-v2-upgrade-token-state.service";

describe("DefaultV2UpgradeTokenStateService", () => {
  let sut: DefaultV2UpgradeTokenStateService;
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;

  const userId = "00000000-0000-0000-0000-000000000000" as UserId;
  const token = {
    wrapped_user_key_1: "wrapped-1",
    wrapped_user_key_2: "wrapped-2",
  } as unknown as V2UpgradeToken;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
    sut = new DefaultV2UpgradeTokenStateService(stateProvider);
  });

  describe("v2UpgradeToken$", () => {
    it("emits null when no token is stored", async () => {
      const result = await firstValueFrom(sut.v2UpgradeToken$(userId));
      expect(result).toBeNull();
    });

    it("emits the stored token", async () => {
      stateProvider.singleUser.getFake(userId, V2_UPGRADE_TOKEN).nextState(token);

      const result = await firstValueFrom(sut.v2UpgradeToken$(userId));
      expect(result).toEqual(token);
    });

    it("throws when userId is null", () => {
      expect(() => sut.v2UpgradeToken$(null as unknown as UserId)).toThrow(
        "userId is null or undefined.",
      );
    });

    it("throws when userId is undefined", () => {
      expect(() => sut.v2UpgradeToken$(undefined as unknown as UserId)).toThrow(
        "userId is null or undefined.",
      );
    });
  });

  describe("setV2UpgradeToken", () => {
    it("persists the token to the V2_UPGRADE_TOKEN state", async () => {
      await sut.setV2UpgradeToken(token, userId);

      const stored = await firstValueFrom(stateProvider.getUser(userId, V2_UPGRADE_TOKEN).state$);
      expect(stored).toEqual(token);
    });

    it("overwrites an existing token", async () => {
      const existing = {
        wrapped_user_key_1: "old-1",
        wrapped_user_key_2: "old-2",
      } as unknown as V2UpgradeToken;
      stateProvider.singleUser.getFake(userId, V2_UPGRADE_TOKEN).nextState(existing);

      await sut.setV2UpgradeToken(token, userId);

      const stored = await firstValueFrom(stateProvider.getUser(userId, V2_UPGRADE_TOKEN).state$);
      expect(stored).toEqual(token);
    });

    it("throws when token is null", async () => {
      await expect(
        sut.setV2UpgradeToken(null as unknown as V2UpgradeToken, userId),
      ).rejects.toThrow("token is null or undefined.");
    });

    it("throws when token is undefined", async () => {
      await expect(
        sut.setV2UpgradeToken(undefined as unknown as V2UpgradeToken, userId),
      ).rejects.toThrow("token is null or undefined.");
    });

    it("throws when userId is null", async () => {
      await expect(sut.setV2UpgradeToken(token, null as unknown as UserId)).rejects.toThrow(
        "userId is null or undefined.",
      );
    });

    it("throws when userId is undefined", async () => {
      await expect(sut.setV2UpgradeToken(token, undefined as unknown as UserId)).rejects.toThrow(
        "userId is null or undefined.",
      );
    });
  });

  describe("clearV2UpgradeToken", () => {
    it("clears an existing token", async () => {
      stateProvider.singleUser.getFake(userId, V2_UPGRADE_TOKEN).nextState(token);

      await sut.clearV2UpgradeToken(userId);

      const stored = await firstValueFrom(stateProvider.getUser(userId, V2_UPGRADE_TOKEN).state$);
      expect(stored).toBeNull();
    });

    it("does not write to disk when no token is stored", async () => {
      const fakeState = stateProvider.singleUser.getFake(userId, V2_UPGRADE_TOKEN);

      await sut.clearV2UpgradeToken(userId);

      expect(fakeState.nextMock).not.toHaveBeenCalled();
    });

    it("throws when userId is null", async () => {
      await expect(sut.clearV2UpgradeToken(null as unknown as UserId)).rejects.toThrow(
        "userId is null or undefined.",
      );
    });

    it("throws when userId is undefined", async () => {
      await expect(sut.clearV2UpgradeToken(undefined as unknown as UserId)).rejects.toThrow(
        "userId is null or undefined.",
      );
    });
  });
});
