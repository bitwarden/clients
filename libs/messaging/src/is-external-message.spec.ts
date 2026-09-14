import { isExternalMessage, stampAsExternal } from "./is-external-message";

type Tamper = (message: Record<PropertyKey, unknown>, key: symbol) => void;

/**
 * Recovers the stamped key the way in-realm code would, rather than importing it. Selects by
 * description because an ingested message can carry other stamps — `stampWebExtSender` applies
 * one ahead of this on every chrome runtime message.
 */
const recoverKey = (message: object) => {
  const key = Object.getOwnPropertySymbols(message).find(
    (symbol) => symbol.description === "externalSource",
  );

  if (key === undefined) {
    throw new Error("no external-source stamp found on the message");
  }

  return key;
};

describe("is-external-message", () => {
  describe("stampAsExternal", () => {
    it("returns the same message instance", () => {
      const message = { command: "test" };

      expect(stampAsExternal(message)).toBe(message);
    });

    it("reads back as external", () => {
      expect(isExternalMessage(stampAsExternal({ command: "test" }))).toBe(true);
    });

    it.each<[string, Tamper]>([
      ["redefined", (message, key) => Object.defineProperty(message, key, { value: false })],
      [
        "reassigned",
        (message, key) => {
          message[key] = false;
        },
      ],
      [
        "deleted",
        (message, key) => {
          delete message[key];
        },
      ],
    ])("stamps a key that cannot be %s", (_shape, tamper) => {
      const message: Record<PropertyKey, unknown> = stampAsExternal({ command: "test" });

      expect(() => tamper(message, recoverKey(message))).toThrow();
      expect(isExternalMessage(message)).toBe(true);
    });

    it("is a no-op when the same message is stamped twice", () => {
      // Deliberately unlike `stampWebExtSender`, which throws on a second stamp: this runs
      // inside a `map` on a shared ingest stream, so a throw would tear the stream down.
      const message = stampAsExternal({ command: "test" });

      expect(stampAsExternal(message)).toBe(message);
      expect(isExternalMessage(message)).toBe(true);
    });

    it.each([
      ["an object spread", (message: object) => ({ ...message })],
      ["Object.assign", (message: object) => Object.assign({}, message)],
    ])("keeps the stamp across %s", (_how, copy) => {
      // An absent stamp is indistinguishable from a message that never crossed a context
      // boundary, so a copy must not read as internal.
      expect(isExternalMessage(copy(stampAsExternal({ command: "test" })))).toBe(true);
    });

    it("does not carry the stamp's hardening to a copy", () => {
      const copy: Record<PropertyKey, unknown> = { ...stampAsExternal({ command: "test" }) };

      expect(() => {
        delete copy[recoverKey(copy)];
      }).not.toThrow();
      expect(isExternalMessage(copy)).toBe(false);
    });

    it.each([
      ["a frozen message", Object.freeze({ command: "test" })],
      ["a sealed message", Object.seal({ command: "test" })],
      ["null", null],
      ["undefined", undefined],
      ["a primitive", 42],
    ])("throws for %s", (_shape, value) => {
      // The ingest boundary owns this precondition. Note a primitive is a narrower contract
      // than the `Object.assign` this replaced, which boxed and silently succeeded.
      expect(() => stampAsExternal(value as Record<PropertyKey, unknown>)).toThrow(TypeError);
    });

    it.each([
      ["structuredClone", structuredClone],
      ["a JSON round-trip", (message: object) => JSON.parse(JSON.stringify(message))],
    ])("loses the stamp across %s", (_how, serialize) => {
      // Symbols do not survive serialization, so a message that re-enters the application
      // must be stamped again at the boundary it arrives on.
      expect(isExternalMessage(serialize(stampAsExternal({ command: "test" })))).toBe(false);
    });
  });

  describe("isExternalMessage", () => {
    it("returns false for a message that was never stamped", () => {
      expect(isExternalMessage({ command: "test" })).toBe(false);
    });

    it.each([null, undefined, "string", 42, true])(
      "returns false for non-objects (%p)",
      (value) => {
        expect(isExternalMessage(value)).toBe(false);
      },
    );

    it.each([
      ["a body property sharing the key's name", { externalSource: true }],
      ["a symbol sharing the key's description", { [Symbol("externalSource")]: true }],
    ])("returns false for %s", (_vector, spoofed) => {
      expect(isExternalMessage(spoofed)).toBe(false);
    });

    it("returns true for a stamped message carrying a contradictory body property", () => {
      expect(isExternalMessage(stampAsExternal({ externalSource: false }))).toBe(true);
    });

    it("requires the stamped value to be exactly true", () => {
      const key = recoverKey(stampAsExternal({ command: "observed" }));

      expect(isExternalMessage({ [key]: "true" })).toBe(false);
    });

    it.each([
      ["an array", [] as unknown[]],
      ["a function", () => "not a message"],
    ])("returns false for %s carrying a stamp", (_shape, value) => {
      // Both can physically hold the stamp, but neither is ever a message. Rejecting them
      // keeps the record narrowing on a `true` result exact.
      stampAsExternal(value as unknown as Record<PropertyKey, unknown>);

      expect(isExternalMessage(value)).toBe(false);
    });

    it("narrows an unknown value to a record", () => {
      const message: unknown = stampAsExternal({ command: "test" });

      if (!isExternalMessage(message)) {
        throw new Error("expected the stamped message to read as external");
      }

      // Compiles only because the guard narrowed `unknown` to a record.
      expect(message.command).toBe("test");
    });

    it("cannot tell a genuine stamp from one minted with a recovered key", () => {
      // Non-configurability stops a stamp being stripped, not forged. In-realm code that has
      // observed a stamped message can reuse the key, so `true` is not proof of provenance.
      const key = recoverKey(stampAsExternal({ command: "observed" }));

      expect(isExternalMessage({ [key]: true })).toBe(true);
    });
  });
});
