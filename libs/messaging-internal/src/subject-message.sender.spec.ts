import { bufferCount, firstValueFrom, Subject } from "rxjs";

import { CommandDefinition, Message } from "@bitwarden/messaging";

import { SubjectMessageSender } from "./subject-message.sender";

describe("SubjectMessageSender", () => {
  const subject = new Subject<Message<{ test: number }>>();
  const subjectObservable = subject.asObservable();

  const sut = new SubjectMessageSender(subject);

  describe("send", () => {
    it("will send message with command from message definition", async () => {
      const commandDefinition = new CommandDefinition<{ test: number }>("myCommand");

      const emissionsPromise = firstValueFrom(subjectObservable.pipe(bufferCount(1)));

      sut.send(commandDefinition, { test: 1 });

      const emissions = await emissionsPromise;

      expect(emissions[0]).toEqual({ command: "myCommand", test: 1 });
    });

    it("will send message with command from normal string", async () => {
      const emissionsPromise = firstValueFrom(subjectObservable.pipe(bufferCount(1)));

      sut.send("myCommand", { test: 1 });

      const emissions = await emissionsPromise;

      expect(emissions[0]).toEqual({ command: "myCommand", test: 1 });
    });

    it("will send message with object even if payload not given", async () => {
      const emissionsPromise = firstValueFrom(subjectObservable.pipe(bufferCount(1)));

      sut.send("myCommand");

      const emissions = await emissionsPromise;

      expect(emissions[0]).toEqual({ command: "myCommand" });
    });

    it.each([null, undefined])(
      "will send message with object even if payload is null-ish (%s)",
      async (payloadValue) => {
        const emissionsPromise = firstValueFrom(subjectObservable.pipe(bufferCount(1)));

        sut.send("myCommand", payloadValue);

        const emissions = await emissionsPromise;

        expect(emissions[0]).toEqual({ command: "myCommand" });
      },
    );
  });
});
