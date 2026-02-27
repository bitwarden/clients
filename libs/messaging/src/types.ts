// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
declare const tag: unique symbol;

/**
 * A class for defining information about a message, this is helpful
 * alonside `MessageSender` and `MessageListener` for providing a type
 * safe(-ish) way of sending and receiving messages.
 */
export class CommandDefinition<T extends Record<string, unknown>> {
  [tag]: T;
  constructor(readonly command: string) {}
}

export type Message<T extends Record<string, unknown>> = { command: string } & T;
