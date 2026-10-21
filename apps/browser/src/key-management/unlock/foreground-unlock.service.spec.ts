import { mock } from "jest-mock-extended";
import { Subject, of } from "rxjs";

import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { MessageListener, MessageSender } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsService, BiometricStateService, KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { CsprngArray, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { StateProvider } from "@bitwarden/state";
import { AutoUnlockService, UnlockCompletedMessage, UnlockMethod } from "@bitwarden/unlock";

import { ForegroundUnlockService } from "./foreground-unlock.service";

const userId = "b1e2d3c4-a1b2-c3d4-e5f6-a1b2c3d4e5f6" as UserId;

describe("ForegroundUnlockService", () => {
  const userKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;

  const accountCryptographicStateService = mock<AccountCryptographicStateService>();
  const masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
  const stateProvider = mock<StateProvider>();
  const logService = mock<LogService>();
  const biometricsService = mock<BiometricsService>();
  const biometricStateService = mock<BiometricStateService>();
  const keyService = mock<KeyService>();
  const sdkService = mock<SdkService>();
  const autoUnlockService = mock<AutoUnlockService>();
  const messageSender = mock<MessageSender>();
  const messageListener = mock<MessageListener>();

  let service: ForegroundUnlockService;
  let backgroundUnlocks: Subject<UnlockCompletedMessage>;

  beforeEach(() => {
    jest.resetAllMocks();

    accountCryptographicStateService.accountCryptographicState$.mockReturnValue(of({} as any));
    sdkService.unlock.mockResolvedValue(userKey);
    biometricStateService.biometricUnlockEnabled$.mockReturnValue(of(false));
    stateProvider.setUserState.mockResolvedValue(undefined);
    biometricsService.unlockWithBiometricsForUser.mockResolvedValue(userKey);

    backgroundUnlocks = new Subject<UnlockCompletedMessage>();
    messageListener.messages$.mockReturnValue(backgroundUnlocks.asObservable() as any);

    service = new ForegroundUnlockService(
      accountCryptographicStateService,
      masterPasswordService,
      stateProvider,
      logService,
      biometricsService,
      biometricStateService,
      keyService,
      sdkService,
      autoUnlockService,
      messageSender,
      messageListener,
    );
  });

  describe("unlockWithBiometrics", () => {
    it("delegates the unlock to the background", async () => {
      await service.unlockWithBiometrics(userId);

      expect(biometricsService.unlockWithBiometricsForUser).toHaveBeenCalledWith(userId);
      expect(sdkService.unlock).not.toHaveBeenCalled();
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
