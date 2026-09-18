import { mock } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import {
  PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL,
  USER_KEY,
} from "@bitwarden/common/key-management/state-definitions";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

import { AfuModeCapability } from "./afu-mode";

describe("AfuModeCapability", () => {
  const userId = "11111111-1111-4111-8111-111111111111" as UserId;
  const userKey = new SymmetricCryptoKey(new Uint8Array(64)) as never;
  const envelope = { envelope: "pin-envelope" } as never;

  let accountService: ReturnType<typeof mockAccountServiceWith>;
  let stateProvider: FakeStateProvider;
  let biometricsService: ReturnType<typeof mock<BiometricsService>>;
  let messagingService: ReturnType<typeof mock<MessagingService>>;
  let sut: AfuModeCapability;

  beforeEach(async () => {
    accountService = mockAccountServiceWith(userId);
    stateProvider = new FakeStateProvider(accountService);
    biometricsService = mock<BiometricsService>();
    messagingService = mock<MessagingService>();
    sut = new AfuModeCapability(accountService, stateProvider, biometricsService, messagingService);

    await stateProvider.setUserState(USER_KEY, userKey, userId);
    await stateProvider.setUserState(PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL, envelope, userId);
  });

  it("clears the in-memory unlock material of the active user", async () => {
    await sut.enter();

    expect(await firstValueFrom(stateProvider.getUser(userId, USER_KEY).state$)).toBeNull();
    expect(
      await firstValueFrom(
        stateProvider.getUser(userId, PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL).state$,
      ),
    ).toBeNull();
    expect(biometricsService.deleteBiometricUnlockKeyForUser).toHaveBeenCalledWith(userId);
  });

  it("moves the client to the lock screen", async () => {
    await sut.enter();

    expect(messagingService.send).toHaveBeenCalledWith("locked", { userId });
  });
});
