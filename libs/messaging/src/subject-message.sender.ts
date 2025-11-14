import { Subject } from "rxjs";

import { getCommand } from "./helpers";
import { MessageSender } from "./message.sender";
import { CommandDefinition, Message } from "./types";

export class SubjectMessageSender implements MessageSender {
  constructor(private readonly messagesSubject: Subject<Message<Record<string, unknown>>>) {}

  send<T extends Record<string, unknown>>(
    commandDefinition: string | CommandDefinition<T>,
    payload: Record<string, unknown> | T = {},
  ): void {
    const command = getCommand(commandDefinition);
    this.messagesSubject.next(Object.assign(payload ?? {}, { command: command }));
  }
}
