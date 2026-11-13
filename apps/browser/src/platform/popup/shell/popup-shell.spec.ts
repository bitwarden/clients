import { POPUP_THEME_STORAGE_KEY } from "../../browser/popup-view";

import { styleShell } from "./popup-shell";

describe("styleShell", () => {
  const styleWith = (stored: string | null, prefersDark: boolean) => {
    if (stored == null) {
      localStorage.removeItem(POPUP_THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(POPUP_THEME_STORAGE_KEY, stored);
    }
    window.matchMedia = jest.fn().mockReturnValue({ matches: prefersDark });
    jest.mocked(chrome.extension.getViews).mockReturnValue([]);

    styleShell();

    return document.documentElement.className;
  };

  afterEach(() => {
    document.documentElement.className = "";
    localStorage.clear();
  });

  it.each([
    ["light", true, "theme_light"],
    ["dark", false, "theme_dark"],
  ])("keeps an explicit %s regardless of the OS", (stored, prefersDark, expected) => {
    expect(styleWith(stored, prefersDark)).toBe(expected);
  });

  it.each([
    [null, true, "theme_dark"],
    [null, false, "theme_light"],
    ["system", true, "theme_dark"],
    ["sepia", false, "theme_light"],
  ])("follows the OS for %s (prefersDark=%s)", (stored, prefersDark, expected) => {
    expect(styleWith(stored, prefersDark)).toBe(expected);
  });
});
