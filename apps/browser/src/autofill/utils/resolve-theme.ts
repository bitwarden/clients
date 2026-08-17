import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";

export function resolveTheme(theme: Theme | string | undefined): Theme {
  if (theme === ThemeTypes.System) {
    return globalThis.matchMedia("(prefers-color-scheme: dark)").matches
      ? ThemeTypes.Dark
      : ThemeTypes.Light;
  }

  return theme === ThemeTypes.Dark ? ThemeTypes.Dark : ThemeTypes.Light;
}
