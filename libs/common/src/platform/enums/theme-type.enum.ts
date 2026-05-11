/**
 * @deprecated prefer the `ThemeTypes` constants and `Theme` type over unsafe enum types
 **/
// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum ThemeType {
  System = "system",
  Light = "light",
  Dark = "dark",
  /** True black backgrounds for OLED displays (always uses dark palette). */
  Oled = "oled",
}

export const ThemeTypes = {
  System: "system",
  Light: "light",
  Dark: "dark",
  Oled: "oled",
} as const;

export type Theme = (typeof ThemeTypes)[keyof typeof ThemeTypes];
