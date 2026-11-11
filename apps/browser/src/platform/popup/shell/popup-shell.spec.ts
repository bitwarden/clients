import { resolveShellTheme, themeClass } from "./popup-shell";

describe("popup shell", () => {
  describe("resolveShellTheme", () => {
    it.each([
      ["light", true, "light"],
      ["dark", false, "dark"],
    ])("keeps an explicit %s regardless of the OS", (stored, prefersDark, expected) => {
      expect(resolveShellTheme(stored, prefersDark)).toBe(expected);
    });

    it.each([
      [null, true, "dark"],
      [null, false, "light"],
      ["system", true, "dark"],
      ["sepia", false, "light"],
    ])("follows the OS for %s (prefersDark=%s)", (stored, prefersDark, expected) => {
      expect(resolveShellTheme(stored, prefersDark)).toBe(expected);
    });
  });

  it("builds the class the theming service applies", () => {
    expect(themeClass("dark")).toBe("theme_dark");
  });
});
