import { mock } from "jest-mock-extended";

import { getWebExtSender, stampWebExtSender } from "./web-ext-sender";

describe("web-ext-sender", () => {
  describe("stampWebExtSender", () => {
    it("returns the same message instance", () => {
      const message = {};
      const sender = mock<chrome.runtime.MessageSender>();

      expect(stampWebExtSender(message, sender)).toBe(message);
    });

    it("does not add an enumerable property to the message", () => {
      const message: Record<string, unknown> = {};

      stampWebExtSender(message, mock<chrome.runtime.MessageSender>());

      expect(Object.keys(message)).toHaveLength(0);
    });

    it("stamps a tamper-resistant property", () => {
      const authentic = mock<chrome.runtime.MessageSender>({ frameId: 0 });
      const message = stampWebExtSender({}, authentic);
      const [key] = Object.getOwnPropertySymbols(message);

      // In-realm code can recover the key but must not be able to overwrite the stamp.
      expect(() => {
        Object.defineProperty(message, key, { value: mock<chrome.runtime.MessageSender>() });
      }).toThrow();
      expect(getWebExtSender(message)).toBe(authentic);
    });

    it("throws if the same message is stamped twice", () => {
      const message = stampWebExtSender({}, mock<chrome.runtime.MessageSender>());

      expect(() => stampWebExtSender(message, mock<chrome.runtime.MessageSender>())).toThrow();
    });
  });

  describe("getWebExtSender", () => {
    it("reads back a stamped sender", () => {
      const sender = mock<chrome.runtime.MessageSender>({ frameId: 3 });
      const message = stampWebExtSender({}, sender);

      expect(getWebExtSender(message)).toBe(sender);
    });

    it("returns undefined for a message that was never stamped", () => {
      expect(getWebExtSender({})).toBeUndefined();
    });

    it.each([null, undefined, "string", 42])("returns undefined for non-objects (%p)", (value) => {
      expect(getWebExtSender(value)).toBeUndefined();
    });

    it("ignores a spoofed `webExtSender` body property", () => {
      // A page can set any property on the body it sends; only the symbol-stamped value
      // is authoritative, so a body `webExtSender` must not be returned here.
      const spoofed = { webExtSender: mock<chrome.runtime.MessageSender>({ frameId: 99 }) };

      expect(getWebExtSender(spoofed)).toBeUndefined();
    });

    it("returns the stamped sender even when a spoofed body property is present", () => {
      const authentic = mock<chrome.runtime.MessageSender>({ frameId: 0 });
      const message = stampWebExtSender(
        { webExtSender: mock<chrome.runtime.MessageSender>({ frameId: 99 }) },
        authentic,
      );

      expect(getWebExtSender(message)).toBe(authentic);
    });
  });
});
