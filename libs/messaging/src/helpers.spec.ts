import { Subject, firstValueFrom, of } from "rxjs";

import { getCommand, tagAsExternal } from "./helpers";
import { isExternalMessage } from "./is-external-message";
import { CommandDefinition, Message } from "./types";

describe("helpers", () => {
  describe("getCommand", () => {
    it("can get the command from just a string", () => {
      const command = getCommand("myCommand");

      expect(command).toEqual("myCommand");
    });

    it("can get the command from a message definition", () => {
      const commandDefinition = new CommandDefinition<Record<string, unknown>>("myCommand");

      const command = getCommand(commandDefinition);

      expect(command).toEqual("myCommand");
    });
  });

  describe("tagAsExternal", () => {
    it("emits a message that reads back as external", async () => {
      const message: Message<Record<string, unknown>> = { command: "test" };

      const tagged = await firstValueFrom(of(message).pipe(tagAsExternal()));

      expect(isExternalMessage(tagged)).toBe(true);
    });

    it("emits the same message instance it ingested", async () => {
      // Tagging a copy would leave the ingested object untagged, and would silently drop
      // non-enumerable tags applied upstream, such as the authoritative sender.
      const message: Message<Record<string, unknown>> = { command: "test" };

      const tagged = await firstValueFrom(of(message).pipe(tagAsExternal()));

      expect(tagged).toBe(message);
    });

    it("errors the stream when a message cannot be tagged", async () => {
      const messages = new Subject<Message<Record<string, unknown>>>();
      const delivered: Message<Record<string, unknown>>[] = [];
      const errors: unknown[] = [];

      messages.pipe(tagAsExternal()).subscribe({
        next: (message) => delivered.push(message),
        error: (error: unknown) => errors.push(error),
      });

      messages.next(42 as unknown as Message<Record<string, unknown>>);
      messages.next({ command: "test" });

      expect(errors).toEqual([expect.any(TypeError)]);
      expect(delivered).toEqual([]);
    });
  });
});
