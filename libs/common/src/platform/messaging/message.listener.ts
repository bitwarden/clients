import { EMPTY, Observable, filter } from "rxjs";

import { Message, CommandDefinition } from "./types";

/**
 * A class that allows for listening to messages coming through the application,
 * allows for listening of all messages or just the messages you care about.
 *
 * @note Consider NOT using messaging at all if you can. State Providers offer an observable stream of
 * data that is persisted. This can serve messages that might have been used to notify of settings changes
 * or vault data changes and those observables should be preferred over messaging.
 */
export class MessageListener {
  constructor(private readonly messageStream: Observable<Message<Record<string, unknown>>>) {}

  /**
   * A stream of all messages sent through the application. It does not contain type information for the
   * other properties on the messages. You are encouraged to instead subscribe to an individual message
   * through {@link messages$}.
   */
  allMessages$ = this.messageStream;

  /**
   * Creates an observable stream filtered to just the command given via the {@link CommandDefinition} and typed
   * to the generic contained in the CommandDefinition. Be careful using this method unless all your messages are being
   * sent through `MessageSender.send`, if that isn't the case you should have lower confidence in the message
   * payload being the expected type.
   *
   * @param commandDefinition The CommandDefinition containing the information about the message type you care about.
   */
  messages$<T extends Record<string, unknown>>(
    commandDefinition: CommandDefinition<T>,
  ): Observable<T> {
    return this.allMessages$.pipe(
      filter((msg) => msg?.command === commandDefinition.command),
    ) as Observable<T>;
  }

  /**
   * A helper property for returning a MessageListener that will never emit any messages and will immediately complete.
   */
  static readonly EMPTY = new MessageListener(EMPTY);
}
