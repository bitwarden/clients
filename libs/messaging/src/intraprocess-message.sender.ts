import { Observable, Subject, merge } from "rxjs";

import { tagAsExternal } from "./helpers";
import { MessageSender } from "./message.sender";
import { SubjectMessageSender } from "./subject-message.sender";
import { CommandDefinition, Message } from "./types";

/**
 * The messaging channel internal to a single context.
 *
 * Owns the subject carrying same-context messages, so holding this object is the only way to
 * publish onto it. Construct one per context.
 *
 * WARNING: This attests where a message came from, never what it contains. Publishing a payload
 * that arrived from elsewhere launders it onto the channel, and nothing here catches that.
 * Validate anything received from another context before republishing it.
 */
export class IntraprocessMessageSender implements MessageSender {
  // `#` rather than `private`, which is erased: the subject has to be unreachable at runtime,
  // including through whatever global a context exposes its container on. It also makes the
  // class nominally typed, so a sender that broadcasts across contexts cannot be substituted
  // where this one is required.
  readonly #messages = new Subject<Message<Record<string, unknown>>>();
  readonly #sender = new SubjectMessageSender(this.#messages);

  send<T extends Record<string, unknown>>(
    commandDefinition: string | CommandDefinition<T>,
    payload: Record<string, unknown> | T = {},
  ): void {
    this.#sender.send(commandDefinition, payload);
  }

  /**
   * This channel's messages, optionally blended with messages from external contexts.
   *
   * `external$` is tagged on its way through, so only a message published on this channel can
   * arrive untagged. Use `isExternalMessage()` to identify these messages.
   *
   * @param ingests - Pass `external$` to blend in another context's messages.
   */
  messages$(ingests?: {
    external$: Observable<Message<Record<string, unknown>>>;
  }): Observable<Message<Record<string, unknown>>> {
    const internal$ = this.#messages.asObservable();
    if (ingests == null) {
      return internal$;
    }

    return merge(internal$, ingests.external$.pipe(tagAsExternal()));
  }
}
