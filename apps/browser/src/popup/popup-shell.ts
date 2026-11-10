import {
  POPUP_WIDTH_STORAGE_KEY,
  PopupWidthOption,
  PopupWidthOptions,
} from "../platform/browser/popup-width";

/**
 * What the popup loader needs to style the static shell before the app bundles run. Kept free of
 * app imports so the loader stays small.
 */

/**
 * `chrome.storage.local` key of the theme state: `global_<stateDefinition>_<key>`. The width
 * comes from `POPUP_WIDTH_STORAGE_KEY` instead, the `localStorage` copy `PopupSizeService` keeps
 * so it can be read synchronously.
 */
export const THEME_STATE_KEY = "global_theming_selection";

export { POPUP_WIDTH_STORAGE_KEY };

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

/**
 * Pixel width for the stored option, falling back to the default like `PopupSizeService` does.
 * Never unset: a popup with no width shrinks to fit the spinner.
 */
export function shellWidthPx(stored: string | null): number {
  // `PopupSizeService.migrateOldWidthOption`: the old "extraWide" is today's "wide".
  const option = stored === "extraWide" ? "wide" : stored;

  if (option != null && option in PopupWidthOptions) {
    return PopupWidthOptions[option as PopupWidthOption];
  }

  return PopupWidthOptions.default;
}

/** Mirrors `BrowserPopupUtils.inPopup`: the action popup has no `uilocation`, or `popup`. */
export function isPopupLocation(href: string): boolean {
  return !href.includes("uilocation=") || href.includes("uilocation=popup");
}
