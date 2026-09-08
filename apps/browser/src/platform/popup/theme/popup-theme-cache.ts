// Imported from the leaf module rather than the `platform/enums` barrel: the barrel pulls in
// rxjs and papaparse transitively, and this file is on the popup's pre-paint critical path.
import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums/theme-type.enum";

/**
 * Caches the resolved theme so the popup's loading state can be painted in the right
 * theme before Angular bootstraps.
 *
 * The configured theme lives in `chrome.storage`, which is only readable asynchronously and
 * only after the app bundles have loaded. Until then the popup renders with no theme class,
 * which resolves to the light theme — so dark-theme users get a white flash. `localStorage`
 * is synchronous and available on the first line of script, so a cached copy lets the very
 * first frame use the correct theme. Same approach as the cached popup width in
 * {@link PopupSizeService.initBodyWidthFromLocalStorage}.
 */

/** localStorage key used to cache the last resolved theme. */
export const POPUP_THEME_STORAGE_KEY = "bw-popup-theme";

/**
 * The themes the popup can actually paint. {@link ThemeTypes.System} is resolved to one of
 * these before it reaches the cache.
 */
const PAINTABLE_THEMES: readonly Theme[] = [ThemeTypes.Light, ThemeTypes.Dark];

const themeClass = (theme: Theme) => `theme_${theme}`;

/** Records the resolved theme for the next popup open. */
export function cacheTheme(theme: Theme) {
  if (!PAINTABLE_THEMES.includes(theme)) {
    return;
  }

  localStorage.setItem(POPUP_THEME_STORAGE_KEY, theme);
}

/**
 * Applies the cached theme class to the document so the loading state paints in the correct
 * theme. Falls back to the OS preference, which covers a first open with an empty cache and
 * matches how {@link ThemeTypes.System} resolves.
 *
 * The theming service overwrites this class once it reads the configured theme, so a stale
 * cache self-corrects on the next frame rather than sticking.
 */
export function applyCachedTheme(window: Window) {
  const cached = localStorage.getItem(POPUP_THEME_STORAGE_KEY) as Theme | null;
  const theme =
    cached != null && PAINTABLE_THEMES.includes(cached)
      ? cached
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? ThemeTypes.Dark
        : ThemeTypes.Light;

  window.document.documentElement.classList.add(themeClass(theme));
}
