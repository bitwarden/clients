/**
 * @deprecated prefer the `ThemeTypes` constants and `Theme` type over unsafe enum types
 **/
export enum ThemeType {
  System = "system",
  Light = "light",
  Dark = "dark",
}

export const ThemeTypes = {
  System: "system",
  Light: "light",
  Dark: "dark",
} as const;

export type Theme = (typeof ThemeTypes)[keyof typeof ThemeTypes];
