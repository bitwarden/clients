// Polyfill for Symbol.dispose required by the unlock service's use of `using`
import "core-js/proposals/explicit-resource-management";

import { mock } from "jest-mock-extended";
import { Subject, of } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { V2UpgradeTokenStateService } from "@bitwarden/common/key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { MessageListener, MessageSender } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import {
  BiometricsService,
  BiometricStateService,
  KdfConfigService,
} from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { CsprngArray, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { StateProvider } from "@bitwarden/state";
import { AutoUnlockService, UnlockCompletedMessage, UnlockMethod } from "@bitwarden/unlock";

import { ForegroundUnlockService } from "./foreground-unlock.service";

const userId = "b1e2d3c4-a1b2-c3d4-e5f6-a1b2c3d4e5f6" as UserId;

describe("ForegroundUnlockService", () => {
  const userKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;

  const registerSdkService = mock<RegisterSdkService>();
  const accountCryptographicStateService = mock<AccountCryptographicStateService>();
  const kdfService = mock<KdfConfigService>();
  const accountService = mock<AccountService>();
  const masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
  const stateProvider = mock<StateProvider>();
  const logService = mock<LogService>();
  const biometricsService = mock<BiometricsService>();
  const biometricStateService = mock<BiometricStateService>();
  const v2UpgradeTokenStateService = mock<V2UpgradeTokenStateService>();
  const autoUnlockService = mock<AutoUnlockService>();
  const messageSender = mock<MessageSender>();
  const messageListener = mock<MessageListener>();

  let service: ForegroundUnlockService;
  let backgroundUnlocks: Subject<UnlockCompletedMessage>;
  let sdkCrypto: { initialize_user_crypto: jest.Mock; get_user_encryption_key: jest.Mock };

  beforeEach(() => {
    jest.resetAllMocks();

    sdkCrypto = {
      initialize_user_crypto: jest.fn().mockResolvedValue(undefined),
      get_user_encryption_key: jest.fn().mockResolvedValue(userKey.toBase64()),
    };
    const sdkRef = {
      value: { crypto: jest.fn().mockReturnValue(sdkCrypto) },
      [Symbol.dispose]: jest.fn(),
    };
    registerSdkService.registerClient$.mockReturnValue(
      of({ take: jest.fn().mockReturnValue(sdkRef) }) as any,
    );
    accountCryptographicStateService.accountCryptographicState$.mockReturnValue(of({} as any));
    kdfService.getKdfConfig$.mockReturnValue(of({ toSdkConfig: () => ({}) } as any));
    accountService.accounts$ = of({ [userId]: { email: "test@example.com" } } as any);
    biometricStateService.biometricUnlockEnabled$.mockReturnValue(of(false));
    v2UpgradeTokenStateService.v2UpgradeToken$.mockReturnValue(of(null));
    stateProvider.setUserState.mockResolvedValue(undefined);
    biometricsService.unlockWithBiometricsForUser.mockResolvedValue(userKey);

    backgroundUnlocks = new Subject<UnlockCompletedMessage>();
    messageListener.messages$.mockReturnValue(backgroundUnlocks.asObservable() as any);

    service = new ForegroundUnlockService(
      registerSdkService,
      accountCryptographicStateService,
      kdfService,
      accountService,
      masterPasswordService,
      stateProvider,
      logService,
      biometricsService,
      biometricStateService,
      v2UpgradeTokenStateService,
      autoUnlockService,
      messageSender,
      messageListener,
    );
  });

  describe("unlockWithBiometrics", () => {
    it("delegates the unlock to the background", async () => {
      await service.unlockWithBiometrics(userId);

      expect(biometricsService.unlockWithBiometricsForUser).toHaveBeenCalledWith(userId);
      expect(sdkCrypto.initialize_user_crypto).not.toHaveBeenCalled();
      expect(messageSender.send).not.toHaveBeenCalled();
    });

    it("throws when the background could not retrieve the key", async () => {
      biometricsService.unlockWithBiometricsForUser.mockResolvedValue(null);

      await expect(service.unlockWithBiometrics(userId)).rejects.toThrow(
        "Failed to unlock with biometrics",
      );
    });

    it("runs the on-unlock actions once, when the background announces the unlock", async () => {
      const action = jest.fn().mockResolvedValue(undefined);
      service.registerOnUnlockAction(action);
      service.init();

      await service.unlockWithBiometrics(userId);
      backgroundUnlocks.next({
        userId,
        userKeyB64: userKey.toBase64(),
        method: UnlockMethod.Biometrics,
      });
      await new Promise(process.nextTick);

      expect(action).toHaveBeenCalledTimes(1);
      expect(action).toHaveBeenCalledWith(userId, expect.anything(), UnlockMethod.Biometrics);
      expect(messageSender.send).not.toHaveBeenCalled();
    });
  });
});
