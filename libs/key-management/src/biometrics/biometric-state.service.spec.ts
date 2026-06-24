import { firstValueFrom } from "rxjs";

import { EncryptedString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import {
  makeEncString,
  trackEmissions,
  FakeStateProvider,
  FakeGlobalState,
  FakeAccountService,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { BiometricStateService, DefaultBiometricStateService } from "./biometric-state.service";
import {
  BIOMETRIC_UNLOCK_ENABLED,
  ENCRYPTED_CLIENT_KEY_HALF,
  FINGERPRINT_VALIDATED,
  PROMPT_AUTOMATICALLY,
  PROMPT_CANCELLED,
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

  describe("encryptedClientKeyHalf$", () => {
    it("emits when the encryptedClientKeyHalf state changes", async () => {
      stateProvider.singleUser
        .getFake(userId, ENCRYPTED_CLIENT_KEY_HALF)
        .nextState(encryptedClientKeyHalf as unknown as EncryptedString);

      expect(await firstValueFrom(sut.encryptedClientKeyHalf$(userId))).toEqual(encClientKeyHalf);
    });

    it("emits null when the encryptedClientKeyHalf state is undefined", async () => {
      stateProvider.singleUser
        .getFake(userId, ENCRYPTED_CLIENT_KEY_HALF)
        .nextState(undefined as unknown as EncryptedString);

      expect(await firstValueFrom(sut.encryptedClientKeyHalf$(userId))).toBe(null);
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
      await sut.setEncryptedClientKeyHalf(encClientKeyHalf, userId);

      expect(await firstValueFrom(sut.encryptedClientKeyHalf$(userId))).toEqual(encClientKeyHalf);
    });
  });

  describe("setPromptCancelled", () => {
    let existingState: Record<UserId, boolean>;

    beforeEach(() => {
      existingState = { ["otherUser" as UserId]: false };
      stateProvider.global.getFake(PROMPT_CANCELLED).stateSubject.next(existingState);
    });

    test("observable is updated", async () => {
      await sut.setUserPromptCancelled(userId);

      expect(await firstValueFrom(sut.promptCancelled$(userId))).toBe(true);
    });

    it("updates state", async () => {
      await sut.setUserPromptCancelled(userId);

      const nextMock = stateProvider.global.getFake(PROMPT_CANCELLED).nextMock;
      expect(nextMock).toHaveBeenCalledWith({ ...existingState, [userId]: true });
      expect(nextMock).toHaveBeenCalledTimes(1);
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
      const emissions = trackEmissions(sut.promptCancelled$(userId));

      await sut.setUserPromptCancelled(userId);

      await sut.resetAllPromptCancelled();

      expect(emissions).toEqual([false, true, false]);
    });
  });

  describe("resetUserPromptCancelled", () => {
    let existingState: Record<UserId, boolean>;
    let state: FakeGlobalState<Record<UserId, boolean>>;

    beforeEach(async () => {
      existingState = { [userId]: true, ["otherUser" as UserId]: false };
      state = stateProvider.global.getFake(PROMPT_CANCELLED);
      state.stateSubject.next(existingState);
    });

    it("deletes specified user prompt cancelled state", async () => {
      await sut.resetUserPromptCancelled("otherUser" as UserId);

      expect(state.nextMock).toHaveBeenCalledWith({ [userId]: true });
      expect(state.nextMock).toHaveBeenCalledTimes(1);
    });

    it("deletes given user's prompt cancelled state", async () => {
      await sut.resetUserPromptCancelled(userId);

      expect(state.nextMock).toHaveBeenCalledWith({ ["otherUser" as UserId]: false });
      expect(state.nextMock).toHaveBeenCalledTimes(1);
    });

    it("updates observable to false", async () => {
      const emissions = trackEmissions(sut.promptCancelled$(userId));

      await sut.resetUserPromptCancelled(userId);

      expect(emissions).toEqual([true, false]);
    });
  });

  describe("setPromptAutomatically", () => {
    test("observable is updated", async () => {
      await sut.setPromptAutomatically(true, userId);

      expect(await firstValueFrom(sut.promptAutomatically$(userId))).toBe(true);
    });

    it("updates state", async () => {
      await sut.setPromptAutomatically(true, userId);

      const nextMock = stateProvider.singleUser.getFake(userId, PROMPT_AUTOMATICALLY).nextMock;
      expect(nextMock).toHaveBeenCalledWith(true);
      expect(nextMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("biometricUnlockEnabled$", () => {
    it("returns when biometricUnlockEnabled state is updated", async () => {
      stateProvider.singleUser.getFake(userId, BIOMETRIC_UNLOCK_ENABLED).nextState(true);

      expect(await firstValueFrom(sut.biometricUnlockEnabled$(userId))).toBe(true);
    });

    it("returns false when biometricUnlockEnabled state is undefined", async () => {
      stateProvider.singleUser
        .getFake(userId, BIOMETRIC_UNLOCK_ENABLED)
        .nextState(undefined as unknown as boolean);

      expect(await firstValueFrom(sut.biometricUnlockEnabled$(userId))).toBe(false);
    });
  });

  describe("setBiometricUnlockEnabled", () => {
    it("updates biometricUnlockEnabled$", async () => {
      await sut.setBiometricUnlockEnabled(true, userId);

      expect(await firstValueFrom(sut.biometricUnlockEnabled$(userId))).toBe(true);
    });

    it("updates state", async () => {
      await sut.setBiometricUnlockEnabled(true, userId);

      expect(
        stateProvider.singleUser.getFake(userId, BIOMETRIC_UNLOCK_ENABLED).nextMock,
      ).toHaveBeenCalledWith(true);
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
