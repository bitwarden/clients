import { mock, MockProxy } from "jest-mock-extended";
import { Subject } from "rxjs";

import { LockSource } from "@bitwarden/common/key-management/lock";
import {
  CommandDefinition,
  MessageListener,
  MessageSender,
} from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/user-core";

import { ForegroundLockService } from "./foreground-lock.service";

describe("ForegroundLockService", () => {
  const userId = "user-id" as UserId;

  let messageSender: MockProxy<MessageSender>;
  let messageListener: MockProxy<MessageListener>;
  let messages: Subject<{ requestId: string }>;

  let sut: ForegroundLockService;

  beforeEach(() => {
    messageSender = mock<MessageSender>();
    messageListener = mock<MessageListener>();
    messages = new Subject<{ requestId: string }>();
    messageListener.messages$.mockReturnValue(messages.asObservable() as never);

    // Reply as soon as the request goes out, so the awaited lock resolves.
    messageSender.send.mockImplementation((_command: unknown, payload: any) => {
      messages.next({ requestId: payload.requestId });
    });

    sut = new ForegroundLockService(messageSender, messageListener);
  });

  it("sends the lock source to the background when locking a user", async () => {
    await sut.lock(userId, LockSource.VaultTimeout);

    expect(messageSender.send).toHaveBeenCalledWith(
      expect.any(CommandDefinition),
      expect.objectContaining({ userId, source: LockSource.VaultTimeout }),
    );
  });

  it("sends the lock source to the background when locking all users", async () => {
    await sut.lockAll(LockSource.Manual);

    expect(messageSender.send).toHaveBeenCalledWith(
      expect.any(CommandDefinition),
      expect.objectContaining({ source: LockSource.Manual }),
    );
  });
});
