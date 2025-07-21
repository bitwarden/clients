import { Subject } from "rxjs";

import { CommandDefinition, Message, MessageSender } from "@bitwarden/messaging";

import { getCommand } from "./helpers";

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
