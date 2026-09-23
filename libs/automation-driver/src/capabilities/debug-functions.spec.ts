import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import {
  InternalMasterPasswordServiceAbstraction,
  syncLegacyMasterKeyState,
} from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { Kdf } from "@bitwarden/sdk-internal";
import { UserKeyRotationServiceAbstraction } from "@bitwarden/user-crypto-management";

import { DebugFunctionsCapability } from "./debug-functions";

jest.mock(
  "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction",
  () => ({
    ...jest.requireActual(
      "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction",
    ),
    syncLegacyMasterKeyState: jest.fn(),
  }),
);

describe("DebugFunctionsCapability", () => {
  const userId = "11111111-1111-4111-8111-111111111111" as UserId;

  let sdkService: ReturnType<typeof mock<SdkService>>;
  let masterPasswordService: ReturnType<typeof mock<InternalMasterPasswordServiceAbstraction>>;
  let userKeyRotationService: ReturnType<typeof mock<UserKeyRotationServiceAbstraction>>;
  let userCryptoManagement: { change_kdf: jest.Mock };
  let sut: DebugFunctionsCapability;

  beforeEach(() => {
    jest.clearAllMocks();

    sdkService = mock<SdkService>();
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    userKeyRotationService = mock<UserKeyRotationServiceAbstraction>();

    // Minimal SDK client exposing only the user crypto management surface.
    userCryptoManagement = { change_kdf: jest.fn() };
    sdkService.userClient$.mockReturnValue(
      of({
        take: () => ({
          value: { user_crypto_management: () => userCryptoManagement },
          [Symbol.dispose]: jest.fn(),
        }),
      } as any),
    );

    sut = new DebugFunctionsCapability(
      mockAccountServiceWith(userId),
      sdkService,
      masterPasswordService,
      userKeyRotationService,
    );
  });

  it("changes the KDF of the active user and syncs the legacy master key", async () => {
    const kdf: Kdf = { pBKDF2: { iterations: 600000 } };

    await sut.changeKdf("pw", kdf);

    expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
    expect(userCryptoManagement.change_kdf).toHaveBeenCalledWith("pw", kdf);
    expect(syncLegacyMasterKeyState).toHaveBeenCalledWith(userId, "pw", masterPasswordService);
  });

  it.each(["Skip", "CreateIfNeeded"] as const)(
    "rotates the active user's key with upgrade token action %s",
    async (upgradeTokenAction) => {
      userKeyRotationService.rotateUserKey.mockResolvedValue(true);
      const method = { Password: { password: "pw" } };

      await expect(sut.rotateUserKey(method, upgradeTokenAction)).resolves.toBe(true);

      expect(userKeyRotationService.rotateUserKey).toHaveBeenCalledWith(
        method,
        upgradeTokenAction,
        userId,
      );
    },
  );
});
