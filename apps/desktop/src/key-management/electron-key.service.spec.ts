import { mock } from "jest-mock-extended";

import { PinServiceAbstraction } from "@bitwarden/auth/common";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { FakeMasterPasswordService } from "@bitwarden/common/key-management/master-password/services/fake-master-password.service";
import { KeyGenerationService } from "@bitwarden/common/platform/abstractions/key-generation.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricStateService, KdfConfigService } from "@bitwarden/key-management";

import {
  makeSymmetricCryptoKey,
  FakeAccountService,
  mockAccountServiceWith,
  FakeStateProvider,
} from "../../../../libs/common/spec";

import { DesktopBiometricsService } from "./biometrics/desktop.biometrics.service";
import { ElectronKeyService } from "./electron-key.service";

describe("ElectronKeyService", () => {
  let keyService: ElectronKeyService;

  const pinService = mock<PinServiceAbstraction>();
  const keyGenerationService = mock<KeyGenerationService>();
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const encryptService = mock<EncryptService>();
  const platformUtilService = mock<PlatformUtilsService>();
  const logService = mock<LogService>();
  const stateService = mock<StateService>();
  const kdfConfigService = mock<KdfConfigService>();
  const biometricStateService = mock<BiometricStateService>();
  const biometricService = mock<DesktopBiometricsService>();
  let stateProvider: FakeStateProvider;

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId);
    masterPasswordService = new FakeMasterPasswordService();
    stateProvider = new FakeStateProvider(accountService);

    keyService = new ElectronKeyService(
      pinService,
      masterPasswordService,
      keyGenerationService,
      cryptoFunctionService,
      encryptService,
      platformUtilService,
      logService,
      stateService,
      accountService,
      stateProvider,
      biometricStateService,
      kdfConfigService,
      biometricService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("setUserKey", () => {
    const userKey = makeSymmetricCryptoKey() as UserKey;

    describe("store biometric key", () => {
      it("does not set any biometric keys when biometric unlock disabled", async () => {
        biometricStateService.getBiometricUnlockEnabled.mockResolvedValue(false);

        await keyService.setUserKey(userKey, mockUserId);

        expect(biometricService.setBiometricProtectedUnlockKeyForUser).not.toHaveBeenCalled();
        expect(biometricStateService.setEncryptedClientKeyHalf).not.toHaveBeenCalled();
        expect(biometricStateService.getBiometricUnlockEnabled).toHaveBeenCalledWith(mockUserId);
      });

      describe("biometric unlock enabled", () => {
        beforeEach(() => {
          biometricStateService.getBiometricUnlockEnabled.mockResolvedValue(true);
        });

        it("sets null biometric client key half and biometric unlock key when require password on start disabled", async () => {
          biometricStateService.getRequirePasswordOnStart.mockResolvedValue(false);

          await keyService.setUserKey(userKey, mockUserId);

          expect(biometricService.setBiometricProtectedUnlockKeyForUser).toHaveBeenCalledWith(
            mockUserId,
            userKey,
          );
          expect(biometricStateService.setEncryptedClientKeyHalf).not.toHaveBeenCalled();
          expect(biometricStateService.getBiometricUnlockEnabled).toHaveBeenCalledWith(mockUserId);
        });

        describe("require password on start enabled", () => {
          beforeEach(() => {
            biometricStateService.getRequirePasswordOnStart.mockResolvedValue(true);
          });

          it("sets biometric key", async () => {
            await keyService.setUserKey(userKey, mockUserId);

            expect(biometricService.setBiometricProtectedUnlockKeyForUser).toHaveBeenCalledWith(
              mockUserId,
              userKey,
            );
          });
        });
      });
    });
  });
});
