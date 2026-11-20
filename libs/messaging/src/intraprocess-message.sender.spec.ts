import { Observable, Subject, Subscription } from "rxjs";

import { tagAsExternal } from "./helpers";
import { IntraprocessMessageSender } from "./intraprocess-message.sender";
import { isExternalMessage } from "./is-external-message";
import { CommandDefinition, Message } from "./types";

const TEST_COMMAND = new CommandDefinition<{ tabId: number }>("testCommand");

describe("IntraprocessMessageSender", () => {
  let sender: IntraprocessMessageSender;
  let subscriptions: Subscription;

  /**
   * Collects synchronously rather than using the `firstValueFrom`/`bufferCount` idiom of
   * `subject-message.sender.spec.ts`, because several tests here assert the *absence* of an
   * emission, which a promise-based idiom cannot express.
   */
  function collect(messages$: Observable<Message<Record<string, unknown>>>) {
    const received: Message<Record<string, unknown>>[] = [];
    subscriptions.add(messages$.subscribe((message) => received.push(message)));
    return received;
  }

  beforeEach(() => {
    sender = new IntraprocessMessageSender();
    subscriptions = new Subscription();
  });

  afterEach(() => {
    subscriptions.unsubscribe();
  });

  it("delivers a message published on the channel", () => {
    const received = collect(sender.messages$());

    sender.send(TEST_COMMAND, { tabId: 1 });

    expect(received).toEqual([{ command: "testCommand", tabId: 1 }]);
  });

  it("delivers blended messages to the same consumer as its own", () => {
    const external$ = new Subject<Message<Record<string, unknown>>>();
    const received = collect(sender.messages$({ external$ }));

    sender.send(TEST_COMMAND, { tabId: 1 });
    external$.next({ command: TEST_COMMAND.command, tabId: 2 });

    // Compared field-wise rather than by deep equality: blended messages carry the external
    // tag, which is an enumerable own property. Provenance is asserted separately below.
    expect(received.map((message) => message.tabId)).toEqual([1, 2]);
  });

  describe("blended provenance", () => {
    it("tags an untagged blended stream, so only its own messages arrive untagged", () => {
      // The structural guarantee: a caller cannot blend a foreign stream in without its
      // messages being marked, whether or not that stream tagged them itself.
      const external$ = new Subject<Message<Record<string, unknown>>>();
      const received = collect(sender.messages$({ external$ }));

      sender.send(TEST_COMMAND, { tabId: 1 });
      external$.next({ command: TEST_COMMAND.command, tabId: 2 });

      expect(received.map(isExternalMessage)).toEqual([false, true]);
    });

    it("leaves an already-tagged blended stream unchanged", () => {
      // Boundary tagging stays the primary guarantee, so tagging again must be a no-op rather
      // than an error — `fromChromeRuntimeMessaging` already tags what it yields.
      const external$ = new Subject<Message<Record<string, unknown>>>();
      const received = collect(
        sender.messages$({ external$: external$.asObservable().pipe(tagAsExternal()) }),
      );

      sender.send(TEST_COMMAND, { tabId: 1 });
      external$.next({ command: TEST_COMMAND.command, tabId: 2 });

      expect(received.map(isExternalMessage)).toEqual([false, true]);
    });
  });

  describe("channel encapsulation", () => {
    it("keeps the channel unreachable at runtime, not just to the type checker", () => {
      // A `#` field is not a property of the instance, so casting the type away recovers no
      // handle to publish with. Refactoring it to `private` — an erased annotation over an
      // ordinary property — keeps the nominal brand but fails here, which makes this the only
      // guard on that choice. Symbol keys are checked too: they are recoverable by description,
      // and `is-external-message.ts` already keys a message tag that way.
      const isolated = new IntraprocessMessageSender();

      expect(Object.getOwnPropertyNames(isolated)).toEqual([]);
      expect(Object.getOwnPropertySymbols(isolated)).toEqual([]);
    });

    it("does not publish into another sender's channel", () => {
      // Each context owns its channel, so a shared subject would defeat the class entirely.
      const other = new IntraprocessMessageSender();
      const received = collect(sender.messages$());

      other.send(TEST_COMMAND, { tabId: 1 });

      expect(received).toEqual([]);
    });
  });

  describe("no replay", () => {
    // Replaying a capability to a late subscriber is worse than dropping it. Both orderings must
    // drop, and they are different paths: the returned stream is cold, so subscribing late
    // re-subscribes to the subject.
    it("drops a message published before the stream was requested", () => {
      sender.send(TEST_COMMAND, { tabId: 1 });

      const received = collect(sender.messages$());

      expect(received).toEqual([]);
    });

    it("drops a message published before a subscriber attached to an existing stream", () => {
      const messages$ = sender.messages$();

      sender.send(TEST_COMMAND, { tabId: 1 });
      const received = collect(messages$);

      expect(received).toEqual([]);
    });
  });
});
