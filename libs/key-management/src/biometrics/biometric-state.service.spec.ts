import { firstValueFrom } from "rxjs";

import { EncryptedString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import {
  makeEncString,
  trackEmissions,
  FakeStateProvider,
  FakeGlobalState,
  FakeSingleUserState,
  FakeAccountService,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { BiometricStateService, DefaultBiometricStateService } from "./biometric-state.service";
import {
  BIOMETRIC_UNLOCK_ENABLED,
  DISMISSED_REQUIRE_PASSWORD_ON_START_CALLOUT,
  ENCRYPTED_CLIENT_KEY_HALF,
  FINGERPRINT_VALIDATED,
  PROMPT_AUTOMATICALLY,
  PROMPT_CANCELLED,
  REQUIRE_PASSWORD_ON_START,
} from "./biometric.state";

describe("BiometricStateService", () => {
  let sut: BiometricStateService;
  const userId = "userId" as UserId;
  const encClientKeyHalf = makeEncString();
  const encryptedClientKeyHalf = encClientKeyHalf.encryptedString;
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);

    sut = new DefaultBiometricStateService(stateProvider);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("requirePasswordOnStart$", () => {
    it("emits when the require password on start state changes", async () => {
      const state = stateProvider.activeUser.getFake(REQUIRE_PASSWORD_ON_START);
      state.nextState(true);

      expect(await firstValueFrom(sut.requirePasswordOnStart$)).toBe(true);
    });

    it("emits false when the require password on start state is undefined", async () => {
      const state = stateProvider.activeUser.getFake(REQUIRE_PASSWORD_ON_START);
      state.nextState(undefined as unknown as boolean);

      expect(await firstValueFrom(sut.requirePasswordOnStart$)).toBe(false);
    });
  });

  describe("encryptedClientKeyHalf$", () => {
    it("emits when the encryptedClientKeyHalf state changes", async () => {
      const state = stateProvider.activeUser.getFake(ENCRYPTED_CLIENT_KEY_HALF);
      state.nextState(encryptedClientKeyHalf as unknown as EncryptedString);

      expect(await firstValueFrom(sut.encryptedClientKeyHalf$)).toEqual(encClientKeyHalf);
    });

    it("emits false when the encryptedClientKeyHalf state is undefined", async () => {
      const state = stateProvider.activeUser.getFake(ENCRYPTED_CLIENT_KEY_HALF);
      state.nextState(undefined as unknown as EncryptedString);

      expect(await firstValueFrom(sut.encryptedClientKeyHalf$)).toBe(null);
    });
  });

  describe("fingerprintValidated$", () => {
    it("emits when the fingerprint validated state changes", async () => {
      const state = stateProvider.global.getFake(FINGERPRINT_VALIDATED);
      state.stateSubject.next(undefined as unknown as boolean);

      expect(await firstValueFrom(sut.fingerprintValidated$)).toBe(false);

      state.stateSubject.next(true);

      expect(await firstValueFrom(sut.fingerprintValidated$)).toEqual(true);
    });
  });

  describe("setEncryptedClientKeyHalf", () => {
    it("updates encryptedClientKeyHalf$", async () => {
      await sut.setEncryptedClientKeyHalf(encClientKeyHalf);

      expect(await firstValueFrom(sut.encryptedClientKeyHalf$)).toEqual(encClientKeyHalf);
    });
  });

  describe("setRequirePasswordOnStart", () => {
    it("updates the requirePasswordOnStart$", async () => {
      await sut.setRequirePasswordOnStart(true);

      expect(await firstValueFrom(sut.requirePasswordOnStart$)).toBe(true);
    });

    it("removes the encryptedClientKeyHalf when the set value is false", async () => {
      await sut.setEncryptedClientKeyHalf(encClientKeyHalf, userId);
      await sut.setRequirePasswordOnStart(false);

      const keyHalfState = stateProvider.getUser(
        userId,
        ENCRYPTED_CLIENT_KEY_HALF,
      ) as FakeSingleUserState<EncryptedString>;
      expect(await firstValueFrom(keyHalfState.state$)).toBe(null);
      expect(keyHalfState.nextMock).toHaveBeenCalledWith(null);
    });

    it("does not remove the encryptedClientKeyHalf when the value is true", async () => {
      await sut.setEncryptedClientKeyHalf(encClientKeyHalf);
      await sut.setRequirePasswordOnStart(true);

      expect(await firstValueFrom(sut.encryptedClientKeyHalf$)).toEqual(encClientKeyHalf);
    });
  });

  describe("getRequirePasswordOnStart", () => {
    it("returns the requirePasswordOnStart state value", async () => {
      stateProvider.singleUser.mockFor(userId, REQUIRE_PASSWORD_ON_START, true);

      expect(await sut.getRequirePasswordOnStart(userId)).toBe(true);
    });
  });

  describe("require password on start callout", () => {
    it("is false when not set", async () => {
      expect(await firstValueFrom(sut.dismissedRequirePasswordOnStartCallout$)).toBe(false);
    });

    it("is true when set", async () => {
      await sut.setDismissedRequirePasswordOnStartCallout();

      expect(await firstValueFrom(sut.dismissedRequirePasswordOnStartCallout$)).toBe(true);
    });

    it("updates disk state when called", async () => {
      await sut.setDismissedRequirePasswordOnStartCallout();

      expect(
        stateProvider.activeUser.getFake(DISMISSED_REQUIRE_PASSWORD_ON_START_CALLOUT).nextMock,
      ).toHaveBeenCalledWith([userId, true]);
    });
  });

  describe("setPromptCancelled", () => {
    let existingState: Record<UserId, boolean>;

    beforeEach(() => {
      existingState = { ["otherUser" as UserId]: false };
      stateProvider.global.getFake(PROMPT_CANCELLED).stateSubject.next(existingState);
    });

    test("observable is updated", async () => {
      await sut.setUserPromptCancelled();

      expect(await firstValueFrom(sut.promptCancelled$)).toBe(true);
    });

    it("updates state", async () => {
      await sut.setUserPromptCancelled();

      const nextMock = stateProvider.global.getFake(PROMPT_CANCELLED).nextMock;
      expect(nextMock).toHaveBeenCalledWith({ ...existingState, [userId]: true });
      expect(nextMock).toHaveBeenCalledTimes(1);
    });

    it("throws when called with no active user", async () => {
      await accountService.switchAccount(null as unknown as UserId);
      await expect(sut.setUserPromptCancelled()).rejects.toThrow(
        "Cannot update biometric prompt cancelled state without an active user",
      );
      const nextMock = stateProvider.global.getFake(PROMPT_CANCELLED).nextMock;
      expect(nextMock).not.toHaveBeenCalled();
    });
  });

  describe("resetAllPromptCancelled", () => {
    it("deletes all prompt cancelled state", async () => {
      await sut.resetAllPromptCancelled();

      const nextMock = stateProvider.global.getFake(PROMPT_CANCELLED).nextMock;
      expect(nextMock).toHaveBeenCalledWith(null);
      expect(nextMock).toHaveBeenCalledTimes(1);
    });

    it("updates observable to false", async () => {
      const emissions = trackEmissions(sut.promptCancelled$);

      await sut.setUserPromptCancelled();

      await sut.resetAllPromptCancelled();

      expect(emissions).toEqual([false, true, false]);
    });
  });

  describe("resetUserPromptCancelled", () => {
    let existingState: Record<UserId, boolean>;
    let state: FakeGlobalState<Record<UserId, boolean>>;

    beforeEach(async () => {
      await accountService.switchAccount(userId);
      existingState = { [userId]: true, ["otherUser" as UserId]: false };
      state = stateProvider.global.getFake(PROMPT_CANCELLED);
      state.stateSubject.next(existingState);
    });

    it("deletes specified user prompt cancelled state", async () => {
      await sut.resetUserPromptCancelled("otherUser" as UserId);

      expect(state.nextMock).toHaveBeenCalledWith({ [userId]: true });
      expect(state.nextMock).toHaveBeenCalledTimes(1);
    });

    it("deletes active user when called with no user", async () => {
      await sut.resetUserPromptCancelled();

      expect(state.nextMock).toHaveBeenCalledWith({ ["otherUser" as UserId]: false });
      expect(state.nextMock).toHaveBeenCalledTimes(1);
    });

    it("updates observable to false", async () => {
      const emissions = trackEmissions(sut.promptCancelled$);

      await sut.resetUserPromptCancelled();

      expect(emissions).toEqual([true, false]);
    });
  });

  describe("setPromptAutomatically", () => {
    test("observable is updated", async () => {
      await sut.setPromptAutomatically(true);

      expect(await firstValueFrom(sut.promptAutomatically$)).toBe(true);
    });

    it("updates state", async () => {
      await sut.setPromptAutomatically(true);

      const nextMock = stateProvider.activeUser.getFake(PROMPT_AUTOMATICALLY).nextMock;
      expect(nextMock).toHaveBeenCalledWith([userId, true]);
      expect(nextMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("biometricUnlockEnabled$", () => {
    it("emits when biometricUnlockEnabled state is updated", async () => {
      const state = stateProvider.activeUser.getFake(BIOMETRIC_UNLOCK_ENABLED);
      state.nextState(true);

      expect(await firstValueFrom(sut.biometricUnlockEnabled$)).toBe(true);
    });

    it("emits false when biometricUnlockEnabled state is undefined", async () => {
      const state = stateProvider.activeUser.getFake(BIOMETRIC_UNLOCK_ENABLED);
      state.nextState(undefined as unknown as boolean);

      expect(await firstValueFrom(sut.biometricUnlockEnabled$)).toBe(false);
    });
  });

  describe("setBiometricUnlockEnabled", () => {
    it("updates biometricUnlockEnabled$", async () => {
      await sut.setBiometricUnlockEnabled(true);

      expect(await firstValueFrom(sut.biometricUnlockEnabled$)).toBe(true);
    });

    it("updates state", async () => {
      await sut.setBiometricUnlockEnabled(true);

      expect(
        stateProvider.activeUser.getFake(BIOMETRIC_UNLOCK_ENABLED).nextMock,
      ).toHaveBeenCalledWith([userId, true]);
    });
  });

  describe("getBiometricUnlockEnabled", () => {
    it("returns biometricUnlockEnabled state for the given user", async () => {
      stateProvider.singleUser.getFake(userId, BIOMETRIC_UNLOCK_ENABLED).nextState(true);

      expect(await sut.getBiometricUnlockEnabled(userId)).toBe(true);
    });

    it("returns false when the state is not set", async () => {
      stateProvider.singleUser
        .getFake(userId, BIOMETRIC_UNLOCK_ENABLED)
        .nextState(undefined as unknown as boolean);

      expect(await sut.getBiometricUnlockEnabled(userId)).toBe(false);
    });
  });

  describe("setFingerprintValidated", () => {
    it("updates fingerprintValidated$", async () => {
      await sut.setFingerprintValidated(true);

      expect(await firstValueFrom(sut.fingerprintValidated$)).toBe(true);
    });

    it("updates state", async () => {
      await sut.setFingerprintValidated(true);

      expect(stateProvider.global.getFake(FINGERPRINT_VALIDATED).nextMock).toHaveBeenCalledWith(
        true,
      );
    });
  });
});
