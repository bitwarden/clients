/**
 * @deprecated prefer the `ThemeTypes` constants and `Theme` type over unsafe enum types
 **/
export enum ThemeType {
  System = "system",
  Light = "light",
  Dark = "dark",
  Nord = "nord",
  SolarizedDark = "solarizedDark",
}

export const ThemeTypes = {
  System: "system",
  Light: "light",
  Dark: "dark",
  Nord: "nord",
  SolarizedDark: "solarizedDark",
} as const;

export type Theme = (typeof ThemeTypes)[keyof typeof ThemeTypes];
