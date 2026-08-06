import { mock, MockProxy } from "jest-mock-extended";

import { MessageSender } from "@bitwarden/common/platform/messaging";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UnlockService, UnlockSource } from "@bitwarden/unlock";
import { UserId } from "@bitwarden/user-core";

import { SHARED_UNLOCK_LOCAL_UNLOCK } from "../shared-unlock-messages";

import { ForegroundUnlockNotifierService } from "./foreground-unlock-notifier.service";

describe("ForegroundUnlockNotifierService", () => {
  const userId = "user-id" as UserId;
  const userKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray);

  let unlockService: MockProxy<UnlockService>;
  let messageSender: MockProxy<MessageSender>;

  let sut: ForegroundUnlockNotifierService;

  beforeEach(() => {
    unlockService = mock<UnlockService>();
    messageSender = mock<MessageSender>();

    sut = new ForegroundUnlockNotifierService(unlockService, messageSender);
  });

  it("forwards unlocks to the background with their source, but not the user key", async () => {
    sut.init();

    const onUnlockAction = unlockService.registerOnUnlockAction.mock.calls[0][0];
    await onUnlockAction(userId, userKey, UnlockSource.Manual);

    expect(messageSender.send).toHaveBeenCalledWith(SHARED_UNLOCK_LOCAL_UNLOCK, {
      userId,
      source: UnlockSource.Manual,
    });
  });
});
