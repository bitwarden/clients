import { detectInitialModifier, isPrimaryModifier } from "./modifier-key";

const keydown = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

/** A stand-in for `DOCUMENT`; only `defaultView.navigator` is read. */
const docWith = (navigator: Partial<Navigator> | undefined) =>
  ({ defaultView: navigator && { navigator } }) as unknown as Document;

describe("isPrimaryModifier", () => {
  it.each([
    ["Ctrl alone", { ctrlKey: true }, true],
    ["Cmd alone", { metaKey: true }, true],
    ["both, which is ambiguous", { ctrlKey: true, metaKey: true }, false],
    ["neither", {}, false],
  ])("is %s -> %s", (_, init, expected) => {
    expect(isPrimaryModifier(keydown(init))).toBe(expected);
  });

  it("ignores Alt and Shift, which the caller guards separately", () => {
    expect(isPrimaryModifier(keydown({ ctrlKey: true, altKey: true, shiftKey: true }))).toBe(true);
  });
});

describe("detectInitialModifier", () => {
  it("seeds Command from a Mac platform", () => {
    expect(detectInitialModifier(docWith({ platform: "MacIntel" }))).toBe("Command");
  });

  it("seeds Command from a Mac user agent alone", () => {
    const navigator = {
      platform: "",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    };

    expect(detectInitialModifier(docWith(navigator))).toBe("Command");
  });

  it("seeds Ctrl everywhere else", () => {
    const navigator = { platform: "Win32", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" };

    expect(detectInitialModifier(docWith(navigator))).toBe("Ctrl");
  });

  it("falls back to Ctrl when there is no window to read", () => {
    expect(detectInitialModifier(docWith(undefined))).toBe("Ctrl");
  });
});
