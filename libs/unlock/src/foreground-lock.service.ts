import { filter, firstValueFrom } from "rxjs";

import {
  CommandDefinition,
  MessageListener,
  MessageSender,
} from "@bitwarden/common/platform/messaging";
import { newGuid } from "@bitwarden/guid";
import { UserId } from "@bitwarden/user-core";

import { LockSource } from "./lock-source.enum";
import { LockService } from "./lock.service";

const LOCK_ALL_FINISHED = new CommandDefinition<{ requestId: string }>("lockAllFinished");
const LOCK_ALL = new CommandDefinition<{ requestId: string; source: LockSource }>("lockAll");
const LOCK_USER_FINISHED = new CommandDefinition<{ requestId: string }>("lockUserFinished");
const LOCK_USER = new CommandDefinition<{
  requestId: string;
  userId: UserId;
  source: LockSource;
}>("lockUser");

export class ForegroundLockService implements LockService {
  constructor(
    private readonly messageSender: MessageSender,
    private readonly messageListener: MessageListener,
  ) {}

  async lockAll(source: LockSource): Promise<void> {
    const requestId = newGuid();
    const finishMessage = firstValueFrom(
      this.messageListener
        .messages$(LOCK_ALL_FINISHED)
        .pipe(filter((m) => m.requestId === requestId)),
    );

    this.messageSender.send(LOCK_ALL, { requestId, source });

    await finishMessage;
  }

  async lock(userId: UserId, source: LockSource): Promise<void> {
    const requestId = newGuid();
    const finishMessage = firstValueFrom(
      this.messageListener
        .messages$(LOCK_USER_FINISHED)
        .pipe(filter((m) => m.requestId === requestId)),
    );

    this.messageSender.send(LOCK_USER, { requestId, userId, source });

    await finishMessage;
  }

  async runPlatformOnLockActions(userId: UserId, source: LockSource): Promise<void> {}

  async registerOnLockAction(
    action: (userId: UserId, source: LockSource) => Promise<void>,
  ): Promise<void> {}
}
