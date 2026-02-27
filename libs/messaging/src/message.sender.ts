import { CommandDefinition } from "./types";

class MultiMessageSender implements MessageSender {
  constructor(private readonly innerMessageSenders: MessageSender[]) {}

  send<T extends Record<string, unknown>>(
    commandDefinition: string | CommandDefinition<T>,
    payload: Record<string, unknown> | T = {},
  ): void {
    for (const messageSender of this.innerMessageSenders) {
      messageSender.send(commandDefinition, payload);
    }
  }
}

export abstract class MessageSender {
  /**
   * A method for sending messages in a type safe manner. The passed in command definition
   * will require you to provide a compatible type in the payload parameter.
   *
   * @example
   * const MY_COMMAND = new CommandDefinition<{ test: number }>("myCommand");
   *
   * this.messageSender.send(MY_COMMAND, { test: 14 });
   *
   * @param commandDefinition
   * @param payload
   */
  abstract send<T extends Record<string, unknown>>(
    commandDefinition: CommandDefinition<T>,
    payload: T,
  ): void;

  /**
   * A legacy method for sending messages in a non-type safe way.
   *
   * @remarks Consider defining a {@link CommandDefinition} and passing that in for the first parameter to
   * get compilation errors when defining an incompatible payload.
   *
   * @param command The string based command of your message.
   * @param payload Extra contextual information regarding the message. Be aware that this payload may
   *   be serialized and lose all prototype information.
   */
  abstract send(command: string, payload?: Record<string, unknown>): void;

  /** Implementation of the other two overloads, read their docs instead. */
  abstract send<T extends Record<string, unknown>>(
    commandDefinition: CommandDefinition<T> | string,
    payload: T | Record<string, unknown>,
  ): void;

  /**
   * A helper method for combine multiple {@link MessageSender}'s.
   * @param messageSenders The message senders that should be combined.
   * @returns A message sender that will relay all messages to the given message senders.
   */
  static combine(...messageSenders: MessageSender[]) {
    return new MultiMessageSender(messageSenders);
  }

  /**
   * A helper property for creating a {@link MessageSender} that sends to nowhere.
   */
  static readonly EMPTY: MessageSender = new MultiMessageSender([]);
}
