import { Subject } from "rxjs";

import { subscribeTo } from "../../../spec/observable-tracker";

import { SubjectMessageSender } from "./internal";
import { MessageSender } from "./message.sender";
import { Message, CommandDefinition } from "./types";

describe("SubjectMessageSender", () => {
  const subject = new Subject<Message<{ test: number }>>();
  const subjectObservable = subject.asObservable();

  const sut: MessageSender = new SubjectMessageSender(subject);

  describe("send", () => {
    it("will send message with command from message definition", async () => {
      const commandDefinition = new CommandDefinition<{ test: number }>("myCommand");

      const tracker = subscribeTo(subjectObservable);
      const pausePromise = tracker.pauseUntilReceived(1);

      sut.send(commandDefinition, { test: 1 });

      await pausePromise;

      expect(tracker.emissions[0]).toEqual({ command: "myCommand", test: 1 });
    });

    it("will send message with command from normal string", async () => {
      const tracker = subscribeTo(subjectObservable);
      const pausePromise = tracker.pauseUntilReceived(1);

      sut.send("myCommand", { test: 1 });

      await pausePromise;

      expect(tracker.emissions[0]).toEqual({ command: "myCommand", test: 1 });
    });

    it("will send message with object even if payload not given", async () => {
      const tracker = subscribeTo(subjectObservable);
      const pausePromise = tracker.pauseUntilReceived(1);

      sut.send("myCommand");

      await pausePromise;

      expect(tracker.emissions[0]).toEqual({ command: "myCommand" });
    });

    it.each([null, undefined])(
      "will send message with object even if payload is null-ish (%s)",
      async (payloadValue) => {
        const tracker = subscribeTo(subjectObservable);
        const pausePromise = tracker.pauseUntilReceived(1);

        sut.send("myCommand", payloadValue);

        await pausePromise;

        expect(tracker.emissions[0]).toEqual({ command: "myCommand" });
      },
    );
  });
});
