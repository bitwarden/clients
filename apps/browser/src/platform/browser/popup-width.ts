/**
 * Popup width options and their pixel widths. Dependency free: the popup loader applies the
 * stored width before Angular runs, so this cannot import anything that drags the app along.
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
