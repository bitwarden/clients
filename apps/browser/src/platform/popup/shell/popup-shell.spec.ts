import { THEME_SELECTION } from "@bitwarden/common/platform/theming/theme-state.service";

import { THEME_STATE_KEY, resolveShellTheme, themeClass, unwrapStored } from "./popup-shell";

describe("popup shell", () => {
  it("reads the theme from the key the theme state writes to", () => {
    expect(THEME_STATE_KEY).toBe(
      `global_${THEME_SELECTION.stateDefinition.name}_${THEME_SELECTION.key}`,
    );
  });

  describe("unwrapStored", () => {
    it("unwraps the serialization wrapper BrowserLocalStorageService writes", () => {
      expect(unwrapStored({ __json__: true, value: JSON.stringify("wide") })).toBe("wide");
    });

    it("passes a plain value through and maps nothing stored to null", () => {
      expect(unwrapStored("dark")).toBe("dark");
      expect(unwrapStored(undefined)).toBeNull();
    });

    it("maps a wrapper with malformed JSON to null", () => {
      expect(unwrapStored({ __json__: true, value: "{" })).toBeNull();
    });
  });

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
