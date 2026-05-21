import { logSecurityEvent } from "./security-event";

describe("logSecurityEvent", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    globalThis.__SECURITY_LOG__ = false;
  });

  afterEach(() => {
    warnSpy.mockRestore();
    globalThis.__SECURITY_LOG__ = undefined;
  });

  it("does not log when the flag is off", () => {
    logSecurityEvent("rate-limited", { command: "x", tabId: 1, senderClass: "content-script-top" });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("logs when the flag is on", () => {
    globalThis.__SECURITY_LOG__ = true;
    logSecurityEvent("rate-limited", { command: "x", tabId: 1, senderClass: "content-script-top" });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("emits only the documented fields — no payload, no arbitrary keys", () => {
    globalThis.__SECURITY_LOG__ = true;
    logSecurityEvent("schema-parse-failed", {
      command: "fillAutofillInlineMenuCipher",
      senderClass: "content-script-top",
      tabId: 42,
    });
    const [, payload] = warnSpy.mock.calls[0];
    const parsed = JSON.parse(payload as string);
    expect(parsed).toEqual({
      command: "fillAutofillInlineMenuCipher",
      senderClass: "content-script-top",
      tabId: 42,
    });
    // Whatever the caller "thought" they were passing, only the three allowed keys
    // exist in the JSON. The TypeScript signature is the gate.
    expect(Object.keys(parsed).sort()).toEqual(["command", "senderClass", "tabId"]);
  });

  it("tolerates an omitted context", () => {
    globalThis.__SECURITY_LOG__ = true;
    expect(() => logSecurityEvent("sender-class-rejected")).not.toThrow();
  });
});
