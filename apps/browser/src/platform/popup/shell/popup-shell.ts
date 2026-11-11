import {
  POPUP_THEME_STORAGE_KEY,
  POPUP_WIDTH_STORAGE_KEY,
  PopupWidthOptions,
  isPopupLocation,
  parsePopupWidthOption,
} from "../../browser/popup-view";

/**
 * Styles the popup's static shell (`index.ejs`) before the app runs. `popup/main.ts` calls this,
 * then loads the app after the document's `load` event, so this module runs while Chrome is still
 * withholding the popup and must stay free of app imports.
 */

export type ShellTheme = "light" | "dark";

/**
 * Resolves the stored theme the way `AngularThemingService` does. Anything other than an
 * explicit light or dark, including nothing stored yet, follows the OS like the `system` default.
 */
export function resolveShellTheme(stored: string | null, prefersDark: boolean): ShellTheme {
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return prefersDark ? "dark" : "light";
}

export function themeClass(theme: ShellTheme): string {
  return `theme_${theme}`;
}

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

function setTheme(theme: ShellTheme) {
  document.documentElement.classList.remove(themeClass("light"), themeClass("dark"));
  document.documentElement.classList.add(themeClass(theme));
}

/** Whether this document is the action popup, as opposed to the same page opened in a tab. */
function isActionPopup(): boolean {
  if (globalThis.chrome?.extension?.getViews == null) {
    return isPopupLocation(window.location.href);
  }

  return chrome.extension.getViews({ type: "popup" }).includes(window);
}

/**
 * Sizes and themes the shell from the `localStorage` copies `PopupSizeService` and
 * `PopupThemeService` keep, read synchronously because Chrome takes its first frame and sizes the
 * popup once, when it shows it. With no width stored it uses the default, since an unsized popup
 * shrinks to fit the spinner. Cosmetic only; the app applies both itself once it runs.
 */
export function styleShell() {
  try {
    // A tab has no fixed width; `PopupSizeService` makes the same distinction.
    if (isActionPopup()) {
      const option = parsePopupWidthOption(localStorage.getItem(POPUP_WIDTH_STORAGE_KEY));
      document.body.style.width = `${PopupWidthOptions[option ?? "default"]}px`;
    }

    setTheme(resolveShellTheme(localStorage.getItem(POPUP_THEME_STORAGE_KEY), prefersDark()));
  } catch {
    // Leave the shell unstyled rather than block the app from loading.
  }
}
