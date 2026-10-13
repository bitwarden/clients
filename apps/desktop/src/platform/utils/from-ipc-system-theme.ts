import { defer, merge, Observable } from "rxjs";

import { ThemeType } from "@bitwarden/common/platform/enums";

/**
 * @returns An observable watching the system theme via IPC channels
 */
export const fromIpcSystemTheme = () => {
  return merge(
    defer(() => ipc.platform.getSystemTheme()),
    new Observable<ThemeType>((subscriber) => {
      const cleanup = ipc.platform.onSystemThemeUpdated((theme) => subscriber.next(theme));
      return cleanup;
    }),
  );
};
