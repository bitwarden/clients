import { defer, fromEventPattern, merge } from "rxjs";

import { ThemeType } from "@bitwarden/common/platform/enums";

/**
 * @returns An observable watching the system theme via IPC channels
 */
export const fromIpcSystemTheme = () => {
  return merge(
    defer(() => ipc.platform.getSystemTheme()),
    fromEventPattern<ThemeType>((handler) =>
      ipc.platform.onSystemThemeUpdated((theme) => handler(theme)),
    ),
  );
};
