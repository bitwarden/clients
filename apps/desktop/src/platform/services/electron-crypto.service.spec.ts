import { FakeStateProvider } from "@bitwarden/common/../spec/fake-state-provider";
import { mock } from "jest-mock-extended";

import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { BiometricStateService } from "@bitwarden/common/platform/biometrics/biometric-state.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { makeEncString } from "@bitwarden/common/spec";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";

import {
  FakeAccountService,
  mockAccountServiceWith,
} from "../../../../../libs/common/spec/fake-account-service";

import { ElectronCryptoService } from "./electron-crypto.service";

describe("electronCryptoService", () => {
  let sut: ElectronCryptoService;

  const keyGenerationService = mock<KeyGenerationService>();
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const encryptService = mock<EncryptService>();
  const platformUtilService = mock<PlatformUtilsService>();
  const logService = mock<LogService>();
  const stateService = mock<StateService>();
  let accountService: FakeAccountService;
  let stateProvider: FakeStateProvider;
  const biometricStateService = mock<BiometricStateService>();

  const mockUserId = "mock user id" as UserId;

  beforeEach(() => {
    accountService = mockAccountServiceWith("userId" as UserId);
    stateProvider = new FakeStateProvider(accountService);

    sut = new ElectronCryptoService(
      keyGenerationService,
      cryptoFunctionService,
      encryptService,
      platformUtilService,
      logService,
      stateService,
      accountService,
      stateProvider,
      biometricStateService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("setUserKey", () => {
    let mockUserKey: UserKey;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
    });

    describe("Biometric Key refresh", () => {
      const encClientKeyHalf = makeEncString();
      const decClientKeyHalf = "decrypted client key half";

      beforeEach(() => {
        encClientKeyHalf.decrypt = jest.fn().mockResolvedValue(decClientKeyHalf);
      });

      it("sets a Biometric key if getBiometricUnlock is true and the platform supports secure storage", async () => {
        biometricStateService.getBiometricUnlockEnabled.mockResolvedValue(true);
        platformUtilService.supportsSecureStorage.mockReturnValue(true);
        biometricStateService.getRequirePasswordOnStart.mockResolvedValue(true);
        biometricStateService.getEncryptedClientKeyHalf.mockResolvedValue(encClientKeyHalf);

        await sut.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setUserKeyBiometric).toHaveBeenCalledWith(
          expect.objectContaining({ key: expect.any(String), clientEncKeyHalf: decClientKeyHalf }),
          {
            userId: mockUserId,
          },
        );
      });

      it("clears the Biometric key if getBiometricUnlock is false or the platform does not support secure storage", async () => {
        biometricStateService.getBiometricUnlockEnabled.mockResolvedValue(true);
        platformUtilService.supportsSecureStorage.mockReturnValue(false);

        await sut.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setUserKeyBiometric).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
      });

      it("clears the old deprecated Biometric key whenever a User Key is set", async () => {
        await sut.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setCryptoMasterKeyBiometric).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
      });
    });
  });
});
