import { isAutotypeGaShortcut } from "./autotype-ga-policy.data";

describe("isAutotypeGaShortcut", () => {
  it("accepts one or two modifiers and a letter", () => {
    expect(isAutotypeGaShortcut(["Control", "Alt", "B"])).toBe(true);
    expect(isAutotypeGaShortcut(["Super", "K"])).toBe(true);
  });

  it("rejects shortcuts Electron cannot register", () => {
    expect(isAutotypeGaShortcut(["Control", "Alt", "Super", "K"])).toBe(false);
    expect(isAutotypeGaShortcut(["Alt", "Alt", "K"])).toBe(false);
    expect(isAutotypeGaShortcut(["Control", "Bogus"])).toBe(false);
    expect(isAutotypeGaShortcut(["Control", 5])).toBe(false);
    expect(isAutotypeGaShortcut("Ctrl+K")).toBe(false);
  });
});
