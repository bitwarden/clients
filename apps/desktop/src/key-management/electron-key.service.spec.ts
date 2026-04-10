import { mock } from "jest-mock-extended";

import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { KeyGenerationService } from "@bitwarden/common/key-management/crypto";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { FakeMasterPasswordService } from "@bitwarden/common/key-management/master-password/services/fake-master-password.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricStateService, KdfConfigService } from "@bitwarden/key-management";

import {
  FakeAccountService,
  FakeStateProvider,
  makeSymmetricCryptoKey,
  mockAccountServiceWith,
} from "../../../../libs/common/spec";
// eslint-disable-next-line no-restricted-imports
import { VAULT_TIMEOUT } from "../../../../libs/common/src/key-management/vault-timeout";

import { DesktopBiometricsService } from "./biometrics/desktop.biometrics.service";
import { ElectronKeyService } from "./electron-key.service";

describe("ElectronKeyService", () => {
  let keyService: ElectronKeyService;

  const keyGenerationService = mock<KeyGenerationService>();
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const encryptService = mock<EncryptService>();
  const platformUtilService = mock<PlatformUtilsService>();
  const logService = mock<LogService>();
  const stateService = mock<StateService>();
  const kdfConfigService = mock<KdfConfigService>();
  const biometricStateService = mock<BiometricStateService>();
  const biometricService = mock<DesktopBiometricsService>();
  const accountCryptographicStateService = mock<AccountCryptographicStateService>();
  let stateProvider: FakeStateProvider;

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;

  beforeEach(async () => {
    accountService = mockAccountServiceWith(mockUserId);
    masterPasswordService = new FakeMasterPasswordService();
    stateProvider = new FakeStateProvider(accountService);

    await stateProvider.setUserState(VAULT_TIMEOUT, 10, mockUserId);

    keyService = new ElectronKeyService(
      masterPasswordService,
      keyGenerationService,
      cryptoFunctionService,
      encryptService,
      platformUtilService,
      logService,
      stateService,
      accountService,
      stateProvider,
      kdfConfigService,
      biometricService,
      accountCryptographicStateService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("setUserKey", () => {
    const userKey = makeSymmetricCryptoKey() as UserKey;

    describe("store biometric key", () => {
      it("sets biometric key when biometric unlock enabled", async () => {
        await keyService.setUserKey(userKey, mockUserId);

        expect(biometricService.provideUserKey).toHaveBeenCalledWith(
          mockUserId,
          userKey,
        );
        expect(biometricStateService.setEncryptedClientKeyHalf).not.toHaveBeenCalled();
      });
    });
  });
});
