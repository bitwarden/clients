import { filter, firstValueFrom } from "rxjs";

import { LockService } from "@bitwarden/auth/common";
import {
  CommandDefinition,
  MessageListener,
  MessageSender,
} from "@bitwarden/common/platform/messaging";
import { Utils } from "@bitwarden/common/platform/misc/utils";

const LOCK_ALL_FINISHED = new CommandDefinition<{ requestId: string }>("lockAllFinished");
const LOCK_ALL = new CommandDefinition<{ requestId: string }>("lockAll");

export class ForegroundLockService implements LockService {
  constructor(
    private readonly messageSender: MessageSender,
    private readonly messageListener: MessageListener,
  ) {}

  async lockAll(): Promise<void> {
    const requestId = Utils.newGuid();
    const finishMessage = firstValueFrom(
      this.messageListener
        .messages$(LOCK_ALL_FINISHED)
        .pipe(filter((m) => m.requestId === requestId)),
    );

    this.messageSender.send(LOCK_ALL, { requestId });

    await finishMessage;
  }
}
