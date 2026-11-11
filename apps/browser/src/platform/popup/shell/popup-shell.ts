import {
  POPUP_WIDTH_STORAGE_KEY,
  PopupWidthOptions,
  isPopupLocation,
  parsePopupWidthOption,
} from "../../browser/popup-view";

/**
 * Styles the popup's static shell (`index.ejs`) before the app runs. `popup/main.ts` calls this,
 * then loads the app after the document's `load` event, so this module runs while Chrome is still
 * withholding the popup and must stay free of app imports. The ESLint override for pre-load files
 * enforces that.
 */

/**
 * `chrome.storage.local` key of the theme state: `global_<stateDefinition>_<key>`. The width
 * comes from `POPUP_WIDTH_STORAGE_KEY` instead, the `localStorage` copy `PopupSizeService` keeps
 * so it can be read synchronously.
 */
export const THEME_STATE_KEY = "global_theming_selection";

/** Unwraps a value `BrowserLocalStorageService` stored as `{ __json__: true, value: "<json>" }`. */
export function unwrapStored(stored: unknown): unknown {
  if (
    stored != null &&
    typeof stored === "object" &&
    (stored as { __json__?: unknown }).__json__ === true &&
    typeof (stored as { value?: unknown }).value === "string"
  ) {
    try {
      return JSON.parse((stored as { value: string }).value);
    } catch {
      return null;
    }
  }

  return stored ?? null;
}

export type ShellTheme = "light" | "dark";

/**
 * Resolves the stored theme the way `AngularThemingService` does. Anything other than an
 * explicit light or dark, including nothing stored yet, follows the OS like the `system` default.
 */
export function resolveShellTheme(stored: unknown, prefersDark: boolean): ShellTheme {
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
 * Sizes and themes the shell. Chrome sizes the popup once, when it shows it, so the width is set
 * synchronously from the `localStorage` copy `PopupSizeService` keeps, with the default when there
 * is none: an unsized popup shrinks to fit the spinner. The OS color scheme is applied at once,
 * then corrected from the theme state. Cosmetic only; the app applies both itself once it runs.
 */
export function styleShell() {
  try {
    // A tab has no fixed width; `PopupSizeService` makes the same distinction.
    if (isActionPopup()) {
      const option = parsePopupWidthOption(localStorage.getItem(POPUP_WIDTH_STORAGE_KEY));
      document.body.style.width = `${PopupWidthOptions[option ?? "default"]}px`;
    }

    setTheme(resolveShellTheme(null, prefersDark()));
    globalThis.chrome?.storage?.local?.get(THEME_STATE_KEY, (stored) => {
      setTheme(resolveShellTheme(unwrapStored(stored?.[THEME_STATE_KEY]), prefersDark()));
    });
  } catch {
    // Leave the shell unstyled rather than block the app from loading.
  }
}
