// Polyfill for Symbol.dispose required by the unlock service's use of `using`
import "core-js/proposals/explicit-resource-management";

import { mock } from "jest-mock-extended";
import { BehaviorSubject, Observable, Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { V2UpgradeTokenStateService } from "@bitwarden/common/key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { MessageListener, MessageSender } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import {
  BiometricsService,
  BiometricStateService,
  KdfConfigService,
  KeyService,
} from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { CsprngArray, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { StateProvider } from "@bitwarden/state";
import { AutoUnlockService, UnlockCompletedMessage, UnlockMethod } from "@bitwarden/unlock";

import { BackgroundUnlockService } from "./background-unlock.service";

const userId = "b1e2d3c4-a1b2-c3d4-e5f6-a1b2c3d4e5f6" as UserId;

describe("BackgroundUnlockService", () => {
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
  const keyService = mock<KeyService>();
  const sdkService = mock<SdkService>();
  const autoUnlockService = mock<AutoUnlockService>();
  const messageSender = mock<MessageSender>();
  const messageListener = mock<MessageListener>();

  let service: BackgroundUnlockService;
  let popupUnlocks: Subject<UnlockCompletedMessage>;
  let userKeyInBackground: BehaviorSubject<UserKey | null>;
  let clientRequested: jest.Mock;

  // Lets the message pipeline and the awaited observables settle.
  const settle = () => new Promise(process.nextTick);

  const announcePopupUnlock = () =>
    popupUnlocks.next({ userId, userKeyB64: userKey.toBase64(), method: UnlockMethod.Pin });

  beforeEach(() => {
    jest.resetAllMocks();

    popupUnlocks = new Subject<UnlockCompletedMessage>();
    messageListener.messages$.mockReturnValue(popupUnlocks.asObservable() as any);

    userKeyInBackground = new BehaviorSubject<UserKey | null>(null);
    keyService.userKey$.mockReturnValue(userKeyInBackground.asObservable());

    // Records each subscription to the user's client, which is what builds it.
    clientRequested = jest.fn();
    sdkService.userClient$.mockReturnValue(
      new Observable((subscriber) => {
        clientRequested();
        subscriber.next({} as any);
      }),
    );

    service = new BackgroundUnlockService(
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
      keyService,
      sdkService,
      autoUnlockService,
      messageSender,
      messageListener,
    );
    service.init();
  });

  describe("an unlock the popup announces", () => {
    it("builds the user's SDK client, so the SDK runs its local unlock migrations", async () => {
      userKeyInBackground.next(userKey);

      announcePopupUnlock();
      await settle();

      expect(sdkService.userClient$).toHaveBeenCalledWith(userId);
      expect(clientRequested).toHaveBeenCalledTimes(1);
    });

    it("waits for the user key to reach the background before building the client", async () => {
      announcePopupUnlock();
      await settle();

      expect(clientRequested).not.toHaveBeenCalled();

      userKeyInBackground.next(userKey);
      await settle();

      expect(clientRequested).toHaveBeenCalledTimes(1);
    });

    it("gives up when the user key never reaches the background", async () => {
      jest.useFakeTimers({ doNotFake: ["nextTick"] });
      try {
        announcePopupUnlock();
        await settle();
        await jest.advanceTimersByTimeAsync(10_000);

        expect(clientRequested).not.toHaveBeenCalled();
        expect(logService.warning).toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it("runs the registered on-unlock actions first", async () => {
      userKeyInBackground.next(userKey);
      const action = jest.fn().mockImplementation(async () => {
        expect(clientRequested).not.toHaveBeenCalled();
      });
      service.registerOnUnlockAction(action);

      announcePopupUnlock();
      await settle();

      expect(action).toHaveBeenCalledWith(userId, expect.anything(), UnlockMethod.Pin);
      expect(clientRequested).toHaveBeenCalledTimes(1);
    });
  });
});
