import { v } from "../../autofill/security/validators";

import { defineContentNotice, defineContentRequest } from "./handles-content";

describe("handles-content", () => {
  beforeEach(() => {
    (chrome.runtime.sendMessage as jest.Mock).mockReset();
  });

  describe("ContentNoticeHandle", () => {
    it("stamps command + _envPair on the wire", async () => {
      const handle = defineContentNotice<{ foo: number }>({
        command: "fromContent",
        envPair: "content:background",
      });
      await handle.send({ foo: 2 });
      expect((chrome.runtime.sendMessage as jest.Mock).mock.calls[0][0]).toMatchObject({
        command: "fromContent",
        _envPair: "content:background",
        foo: 2,
      });
    });

    it("carries the schema on the handle for receiver-side validation", () => {
      const schema = v.object({
        command: v.literal("fromContent"),
        _envPair: v.literal("content:background"),
        foo: v.number({ int: true, min: 0 }),
      });
      const handle = defineContentNotice<{
        command: "fromContent";
        _envPair: "content:background";
        foo: number;
      }>({
        command: "fromContent",
        envPair: "content:background",
        schema,
      });
      expect(handle.schema).toBe(schema);
    });
  });

  describe("ContentRequestHandle", () => {
    it("resolves with the receiver's response", async () => {
      (chrome.runtime.sendMessage as jest.Mock).mockResolvedValue({ result: "ok" });
      const handle = defineContentRequest<{ q: string }, { result: string }>({
        command: "askFromContent",
        envPair: "content:background",
      });
      const res = await handle.ask({ q: "hello" });
      expect(res).toEqual({ result: "ok" });
    });
  });

  describe("API surface (no notifyTab / no askTab)", () => {
    it("ContentNoticeHandle exposes send only — not notifyTab", () => {
      const handle = defineContentNotice<{ foo: number }>({
        command: "x",
        envPair: "content:background",
      });
      expect(typeof handle.send).toBe("function");
      // notifyTab is intentionally absent — content scripts cannot address tabs.
      expect("notifyTab" in handle).toBe(false);
    });

    it("ContentRequestHandle exposes ask only — not askTab", () => {
      const handle = defineContentRequest<{ q: string }, void>({
        command: "x",
        envPair: "content:background",
      });
      expect(typeof handle.ask).toBe("function");
      expect("askTab" in handle).toBe(false);
    });
  });
});
