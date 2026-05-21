import { v } from "../../autofill/security/validators";

import { defineNotice, defineRequest, onMessageFor, onMessages } from "./browser-api.middleware";

describe("browser-api.middleware", () => {
  const extensionOrigin = "chrome-extension://test-id";

  // Snapshot/restore the singleton listener registry between tests so adapter
  // state never leaks across.
  let registeredListeners: Array<(...args: any[]) => any>;
  let removeListenerMock: jest.Mock;

  beforeEach(() => {
    registeredListeners = [];
    (chrome.runtime.onMessage.addListener as jest.Mock).mockImplementation((cb) => {
      registeredListeners.push(cb);
    });
    removeListenerMock = (chrome.runtime.onMessage.removeListener as jest.Mock).mockImplementation(
      (cb) => {
        registeredListeners = registeredListeners.filter((l) => l !== cb);
      },
    );
    (chrome.runtime.getURL as jest.Mock).mockImplementation(
      (path: string) => `${extensionOrigin}/${path}`,
    );
    (chrome.runtime.sendMessage as jest.Mock).mockReset();
    (chrome.tabs.sendMessage as jest.Mock).mockReset();
  });

  const popupSender = (): chrome.runtime.MessageSender =>
    ({ origin: extensionOrigin }) as chrome.runtime.MessageSender;

  // Drive the registered listener by invoking it directly (simulates the
  // browser kernel delivering a message to our background).
  const deliver = (message: any, sender: chrome.runtime.MessageSender = popupSender()) => {
    return new Promise<unknown>((resolve) => {
      let responded = false;
      for (const listener of registeredListeners) {
        const result = listener(message, sender, (response: unknown) => {
          responded = true;
          resolve(response);
        });
        if (result === false || result === undefined) {
          // Synchronous handler path — no async response coming.
          if (!responded) {
            queueMicrotask(() => resolve(undefined));
          }
        }
      }
    });
  };

  describe("defineNotice + send", () => {
    it("attaches command + _envPair to the wire payload", async () => {
      const handle = defineNotice<{ foo: number }>({
        command: "myNotice",
        envPair: "popup:background",
      });
      await handle.send({ foo: 1 });
      const sent = (chrome.runtime.sendMessage as jest.Mock).mock.calls[0][0];
      expect(sent).toMatchObject({ command: "myNotice", _envPair: "popup:background", foo: 1 });
    });
  });

  describe("defineRequest + ask", () => {
    it("attaches command + _envPair on ask and resolves with the response", async () => {
      (chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({ ok: true });
      const handle = defineRequest<{ q: string }, { ok: boolean }>({
        command: "myRequest",
        envPair: "popup:background",
      });
      const res = await handle.ask({ q: "hi" });
      expect(res).toEqual({ ok: true });
      expect((chrome.runtime.sendMessage as jest.Mock).mock.calls[0][0]).toMatchObject({
        command: "myRequest",
        _envPair: "popup:background",
        q: "hi",
      });
    });
  });

  describe("onMessageFor — notice", () => {
    it("invokes the handler when envPair check passes", async () => {
      const handle = defineNotice<{ foo: number }>({
        command: "myNotice",
        envPair: "popup:background",
      });
      const handler = jest.fn();
      onMessageFor(handle, handler);
      await deliver({ command: "myNotice", _envPair: "popup:background", foo: 1 });
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ foo: 1 }), expect.any(Object));
    });

    it("does NOT invoke the handler when envPair check fails", async () => {
      const handle = defineNotice<{ foo: number }>({
        command: "myNotice",
        envPair: "popup:background",
      });
      const handler = jest.fn();
      onMessageFor(handle, handler);
      // Foreign origin → predicate chain rejects.
      await deliver({ command: "myNotice", _envPair: "popup:background", foo: 1 }, {
        origin: "https://evil.example.com",
      } as chrome.runtime.MessageSender);
      expect(handler).not.toHaveBeenCalled();
    });

    it("ignores messages with a different command", async () => {
      const handle = defineNotice<{ foo: number }>({
        command: "myNotice",
        envPair: "popup:background",
      });
      const handler = jest.fn();
      onMessageFor(handle, handler);
      await deliver({ command: "otherCommand", _envPair: "popup:background" });
      expect(handler).not.toHaveBeenCalled();
    });

    it("rejects when _envPair is missing (fail-closed §2.4)", async () => {
      const handle = defineNotice<{ foo: number }>({
        command: "myNotice",
        envPair: "popup:background",
      });
      const handler = jest.fn();
      onMessageFor(handle, handler);
      await deliver({ command: "myNotice", foo: 1 });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("onMessageFor — request", () => {
    it("ships the handler's resolved value back via sendResponse", async () => {
      const handle = defineRequest<{ q: string }, { ok: boolean }>({
        command: "myRequest",
        envPair: "popup:background",
      });
      onMessageFor(handle, () => ({ ok: true }));
      const response = await deliver({
        command: "myRequest",
        _envPair: "popup:background",
        q: "hi",
      });
      expect(response).toEqual({ ok: true });
    });

    it("responds with null on envPair check failure", async () => {
      const handle = defineRequest<{ q: string }, { ok: boolean }>({
        command: "myRequest",
        envPair: "popup:background",
      });
      const handler = jest.fn(() => ({ ok: true }));
      onMessageFor(handle, handler);
      const response = await deliver(
        {
          command: "myRequest",
          _envPair: "popup:background",
          q: "hi",
        },
        { origin: "https://evil.example.com" } as chrome.runtime.MessageSender,
      );
      expect(handler).not.toHaveBeenCalled();
      expect(response).toBeNull();
    });

    it("responds with null on handler rejection", async () => {
      const handle = defineRequest<{ q: string }, { ok: boolean }>({
        command: "myRequest",
        envPair: "popup:background",
      });
      onMessageFor(handle, () => Promise.reject(new Error("boom")));
      const response = await deliver({
        command: "myRequest",
        _envPair: "popup:background",
        q: "hi",
      });
      expect(response).toBeNull();
    });
  });

  describe("schema enforcement (Track B)", () => {
    it("drops a notice whose payload fails schema parsing", async () => {
      const schema = v.object({
        command: v.literal("schemaNotice"),
        _envPair: v.literal("popup:background"),
        n: v.number({ int: true, min: 0 }),
      });
      const handle = defineNotice<{
        command: "schemaNotice";
        _envPair: "popup:background";
        n: number;
      }>({
        command: "schemaNotice",
        envPair: "popup:background",
        schema,
      });
      const handler = jest.fn();
      onMessageFor(handle, handler);
      await deliver({
        command: "schemaNotice",
        _envPair: "popup:background",
        n: "not-a-number",
      });
      expect(handler).not.toHaveBeenCalled();
    });

    it("calls the handler with the parsed (typed) value when schema passes", async () => {
      const schema = v.object({
        command: v.literal("schemaNotice"),
        _envPair: v.literal("popup:background"),
        n: v.number({ int: true, min: 0 }),
      });
      const handle = defineNotice<{
        command: "schemaNotice";
        _envPair: "popup:background";
        n: number;
      }>({
        command: "schemaNotice",
        envPair: "popup:background",
        schema,
      });
      const handler = jest.fn();
      onMessageFor(handle, handler);
      await deliver({
        command: "schemaNotice",
        _envPair: "popup:background",
        n: 7,
      });
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ n: 7 }), expect.any(Object));
    });

    it("rejects an unknown extra key on the wire (no silent passthrough)", async () => {
      const schema = v.object({
        command: v.literal("schemaNotice"),
        _envPair: v.literal("popup:background"),
      });
      const handle = defineNotice<{ command: "schemaNotice"; _envPair: "popup:background" }>({
        command: "schemaNotice",
        envPair: "popup:background",
        schema,
      });
      const handler = jest.fn();
      onMessageFor(handle, handler);
      await deliver({
        command: "schemaNotice",
        _envPair: "popup:background",
        injectedKey: "<script>...",
      });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("onMessages", () => {
    it("routes by command", async () => {
      const a = defineNotice<{ x: number }>({ command: "a", envPair: "popup:background" });
      const b = defineNotice<{ y: string }>({ command: "b", envPair: "popup:background" });
      const handlerA = jest.fn();
      const handlerB = jest.fn();
      onMessages([
        { handle: a, handler: handlerA },
        { handle: b, handler: handlerB },
      ]);
      await deliver({ command: "b", _envPair: "popup:background", y: "yo" });
      expect(handlerA).not.toHaveBeenCalled();
      expect(handlerB).toHaveBeenCalled();
    });

    it("throws on duplicate command registration", () => {
      const a = defineNotice<{ x: number }>({ command: "dup", envPair: "popup:background" });
      const b = defineNotice<{ y: string }>({ command: "dup", envPair: "popup:background" });
      expect(() =>
        onMessages([
          { handle: a, handler: jest.fn() },
          { handle: b, handler: jest.fn() },
        ]),
      ).toThrow(/duplicate command registration/);
    });

    it("teardown removes the listener", () => {
      const a = defineNotice<{ x: number }>({ command: "tear", envPair: "popup:background" });
      const teardown = onMessages([{ handle: a, handler: jest.fn() }]);
      expect(registeredListeners.length).toBe(1);
      teardown();
      expect(removeListenerMock).toHaveBeenCalled();
      expect(registeredListeners.length).toBe(0);
    });
  });
});
