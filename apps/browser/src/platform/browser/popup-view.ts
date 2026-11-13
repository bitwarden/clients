/**
 * Popup width options and the rules for reading them, the keys of the `localStorage` copies the
 * popup shell reads, and how to tell the popup from a tab by its URL. Dependency free: the popup shell uses these before the app is loaded, so this module cannot
 * import anything that drags the app along.
 */
export const PopupWidthOptions = Object.freeze({
  default: 480,
  wide: 600,
  narrow: 380,
});

type PopupWidthOptions = typeof PopupWidthOptions;
export type PopupWidthOption = keyof PopupWidthOptions;

/** `localStorage` key the popup stores its width under, for a synchronous read at startup. */
export const POPUP_WIDTH_STORAGE_KEY = "bw-popup-width";

/** `localStorage` key the popup stores its selected theme under, for the same reason. */
export const POPUP_THEME_STORAGE_KEY = "bw-popup-theme";

/**
 * The width option a stored value names, or null when it names none. Maps the retired
 * `extraWide` option to `wide`.
 */
export function parsePopupWidthOption(stored: unknown): PopupWidthOption | null {
  const option = stored === "extraWide" ? "wide" : stored;
  return typeof option === "string" && option in PopupWidthOptions
    ? (option as PopupWidthOption)
    : null;
}

/** Whether a popup page URL is the action popup: no `uilocation`, or `uilocation=popup`. */
export function isPopupLocation(href: string): boolean {
  return !href.includes("uilocation=") || href.includes("uilocation=popup");
}
