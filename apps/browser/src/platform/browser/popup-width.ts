/**
 * Popup width options and the `localStorage` key they are cached under.
 *
 * These live apart from `BrowserPopupUtils` so that `popup/bootstrap.ts` can read the
 * cached width before the app bundles load. Importing `browser-popup-utils` there would
 * pull in `BrowserApi` and defeat the point of a dependency-free pre-bootstrap script.
 */

/**
 *
 * Value represents width in pixels
 */
export const PopupWidthOptions = Object.freeze({
  default: 480,
  wide: 600,
  narrow: 380,
});

type PopupWidthOptions = typeof PopupWidthOptions;
export type PopupWidthOption = keyof PopupWidthOptions;

/** localStorage key used to cache the user's configured popup width. */
export const POPUP_WIDTH_STORAGE_KEY = "bw-popup-width";
