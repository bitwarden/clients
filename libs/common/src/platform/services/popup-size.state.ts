import { KeyDefinition, POPUP_STYLE_DISK } from "@bitwarden/state";

export const PopupWidthOptions = Object.freeze({
  default: 480,
  wide: 600,
  narrow: 380,
} as const);

type PopupWidthOptions = typeof PopupWidthOptions;
export type PopupWidthOption = keyof PopupWidthOptions;

export const POPUP_WIDTH = new KeyDefinition<PopupWidthOption>(POPUP_STYLE_DISK, "popup-width", {
  deserializer: (s) => s,
});
