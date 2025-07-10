import { Subject } from "rxjs";

import { subscribeTo } from "../../../spec/observable-tracker";

import { MessageListener } from "./message.listener";
import { Message, CommandDefinition } from "./types";

describe("MessageListener", () => {
  const subject = new Subject<Message<{ test: number }>>();
  const sut = new MessageListener(subject.asObservable());

  const testCommandDefinition = new CommandDefinition<{ test: number }>("myCommand");

  describe("allMessages$", () => {
    it("runs on all nexts", async () => {
      const tracker = subscribeTo(sut.allMessages$);

      const pausePromise = tracker.pauseUntilReceived(2);

      subject.next({ command: "command1", test: 1 });
      subject.next({ command: "command2", test: 2 });

      await pausePromise;

      expect(tracker.emissions[0]).toEqual({ command: "command1", test: 1 });
      expect(tracker.emissions[1]).toEqual({ command: "command2", test: 2 });
    });
  });

  describe("messages$", () => {
    it("runs on only my commands", async () => {
      const tracker = subscribeTo(sut.messages$(testCommandDefinition));

      const pausePromise = tracker.pauseUntilReceived(2);

      subject.next({ command: "notMyCommand", test: 1 });
      subject.next({ command: "myCommand", test: 2 });
      subject.next({ command: "myCommand", test: 3 });
      subject.next({ command: "notMyCommand", test: 4 });

      await pausePromise;

      expect(tracker.emissions[0]).toEqual({ command: "myCommand", test: 2 });
      expect(tracker.emissions[1]).toEqual({ command: "myCommand", test: 3 });
    });
  });
});
