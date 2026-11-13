import { MAX_PAM_DURATION_SECONDS, parseDuration } from "./pam-duration";
import { PamInputError } from "./pam-input-error";

describe("parseDuration", () => {
  it.each([
    ["90", 90],
    ["45s", 45],
    ["30m", 1800],
    ["2h", 7200],
    ["1d", 86400],
    ["2H", 7200],
    [" 15m ", 900],
  ])("parses %s", (text, seconds) => {
    expect(parseDuration(text)).toBe(seconds);
  });

  it("accepts exactly 365 days", () => {
    expect(parseDuration("365d")).toBe(MAX_PAM_DURATION_SECONDS);
  });

  it.each(["0", "0m", "000h"])("refuses the non-positive %s", (text) => {
    expect(() => parseDuration(text)).toThrow("must be greater than zero");
  });

  it.each(["366d", "8761h", "31536001"])("refuses %s as longer than 365 days", (text) => {
    expect(() => parseDuration(text)).toThrow("cannot be longer than 365 days");
  });

  it.each(["", "abc", "-5m", "1.5h", "5 m", "5w", "1e3", undefined, null])(
    "refuses the malformed %p",
    (text) => {
      expect(() => parseDuration(text)).toThrow(PamInputError);
    },
  );

  it("refuses a value too large to be a safe integer", () => {
    expect(() => parseDuration("99999999999999999999d")).toThrow(PamInputError);
  });

  it("names the option in the refusal", () => {
    expect(() => parseDuration("x", "--duration")).toThrow("not a valid --duration");
  });
});
