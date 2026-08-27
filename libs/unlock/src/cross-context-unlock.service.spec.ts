import { mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { V2UpgradeTokenStateService } from "@bitwarden/common/key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import {
  CommandDefinition,
  MessageListener,
  MessageSender,
} from "@bitwarden/common/platform/messaging";
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
import { UserId } from "@bitwarden/user-core";

import { AutoUnlockService } from "./auto-unlock.service";
import { CrossContextUnlockService, UnlockCompletedMessage } from "./cross-context-unlock.service";
import { UnlockMethod } from "./unlock-method.enum";

const userId = "b1e2d3c4-a1b2-c3d4-e5f6-a1b2c3d4e5f6" as UserId;

const THIS_CONTEXT_UNLOCKED = new CommandDefinition<UnlockCompletedMessage>("thisContextUnlocked");
const OTHER_CONTEXT_UNLOCKED = new CommandDefinition<UnlockCompletedMessage>(
  "otherContextUnlocked",
);

class TestUnlockService extends CrossContextUnlockService {
  protected readonly announces = THIS_CONTEXT_UNLOCKED;
  protected readonly listensFor = OTHER_CONTEXT_UNLOCKED;
}

describe("CrossContextUnlockService", () => {
  const userKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as UserKey;

  let messageSender: jest.Mocked<MessageSender>;
  let messageListener: jest.Mocked<MessageListener>;
  let messages: Subject<UnlockCompletedMessage>;

  function createService(): TestUnlockService {
    return new TestUnlockService(
      mock<RegisterSdkService>(),
      mock<AccountCryptographicStateService>(),
      mock<KdfConfigService>(),
      mock<AccountService>(),
      mock<InternalMasterPasswordServiceAbstraction>(),
      mock<StateProvider>(),
      mock<LogService>(),
      mock<BiometricsService>(),
      mock<BiometricStateService>(),
      mock<V2UpgradeTokenStateService>(),
      mock<AutoUnlockService>(),
      messageSender,
      messageListener,
    );
  }

  beforeEach(() => {
    messages = new Subject<UnlockCompletedMessage>();
    messageSender = mock<MessageSender>();
    messageListener = mock<MessageListener>();
    messageListener.messages$.mockReturnValue(messages.asObservable() as any);
  });

  it("announces the unlocks it performs itself to the other context", async () => {
    const service = createService();

    await (service as any).runUnlockActionInOtherProcess(userId, userKey, UnlockMethod.Pin);

    expect(messageSender.send).toHaveBeenCalledWith(THIS_CONTEXT_UNLOCKED, {
      userId,
      userKeyB64: userKey.toBase64(),
      method: UnlockMethod.Pin,
    });
  });

  it("runs its on-unlock actions for the unlocks the other context announces", async () => {
    const service = createService();
    const action = jest.fn().mockResolvedValue(undefined);
    service.registerOnUnlockAction(action);
    service.init();

    expect(messageListener.messages$).toHaveBeenCalledWith(OTHER_CONTEXT_UNLOCKED);

    messages.next({ userId, userKeyB64: userKey.toBase64(), method: UnlockMethod.SharedUnlock });
    await new Promise(process.nextTick);

    expect(action).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ toBase64: expect.any(Function) }),
      UnlockMethod.SharedUnlock,
    );
    expect(action.mock.calls[0][1].toBase64()).toEqual(userKey.toBase64());
  });

  it("emits the unlocks the other context announces on unlocked$", async () => {
    const service = createService();
    const emitted: unknown[] = [];
    service.unlocked$.subscribe((unlock) => emitted.push(unlock));
    service.init();

    messages.next({ userId, userKeyB64: userKey.toBase64(), method: UnlockMethod.SharedUnlock });
    await new Promise(process.nextTick);

    expect(emitted).toEqual([{ userId, method: UnlockMethod.SharedUnlock }]);
  });

  it("does not announce an unlock it was handed by the other context", async () => {
    const service = createService();
    service.init();

    messages.next({ userId, userKeyB64: userKey.toBase64(), method: UnlockMethod.SharedUnlock });
    await new Promise(process.nextTick);

    expect(messageSender.send).not.toHaveBeenCalled();
  });

  it("keeps handling announcements after an on-unlock action throws", async () => {
    const service = createService();
    const action = jest.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
    service.registerOnUnlockAction(action);
    service.init();

    messages.next({ userId, userKeyB64: userKey.toBase64(), method: UnlockMethod.Pin });
    await new Promise(process.nextTick);
    messages.next({ userId, userKeyB64: userKey.toBase64(), method: UnlockMethod.Pin });
    await new Promise(process.nextTick);

    expect(action).toHaveBeenCalledTimes(2);
  });
});
