import { filter, firstValueFrom } from "rxjs";

import { LockService } from "@bitwarden/auth/common";
import {
  CommandDefinition,
  MessageListener,
  MessageSender,
} from "@bitwarden/common/platform/messaging";
import { newGuid } from "@bitwarden/guid";
import { UserId } from "@bitwarden/user-core";

const LOCK_ALL_FINISHED = new CommandDefinition<{ requestId: string }>("lockAllFinished");
const LOCK_ALL = new CommandDefinition<{ requestId: string }>("lockAll");
const LOCK_USER_FINISHED = new CommandDefinition<{ requestId: string }>("lockUserFinished");
const LOCK_USER = new CommandDefinition<{ requestId: string; userId: UserId }>("lockUser");

export class ForegroundLockService implements LockService {
  constructor(
    private readonly messageSender: MessageSender,
    private readonly messageListener: MessageListener,
  ) {}

  async lockAll(): Promise<void> {
    const requestId = newGuid();
    const finishMessage = firstValueFrom(
      this.messageListener
        .messages$(LOCK_ALL_FINISHED)
        .pipe(filter((m) => m.requestId === requestId)),
    );

    this.messageSender.send(LOCK_ALL, { requestId });

    await finishMessage;
  }

  async lock(userId: UserId): Promise<void> {
    const requestId = newGuid();
    const finishMessage = firstValueFrom(
      this.messageListener
        .messages$(LOCK_USER_FINISHED)
        .pipe(filter((m) => m.requestId === requestId)),
    );

    this.messageSender.send(LOCK_USER, { requestId, userId });

    await finishMessage;
  }

  async runPlatformOnLockActions(): Promise<void> {}
}
