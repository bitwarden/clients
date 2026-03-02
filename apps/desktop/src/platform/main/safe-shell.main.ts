import { shell } from "electron";

import { SafeUrls } from "@bitwarden/common/platform/misc/safe-urls";
import { LogService } from "@bitwarden/logging";

/**
 * A wrapper around Electron's shell module with safe versions of methods for opening external URLs.
 */
export class SafeShell {
  constructor(private readonly logService: LogService) {}

  /**
   * Open the given external protocol URL in the desktop's default manner if it is considered safe. (For example, mailto: URLs in the user's default mail agent).
   */
  static openExternal(
    url: string,
    logService: LogService,
    options?: Electron.OpenExternalOptions,
  ): void {
    if (SafeUrls.canLaunch(url)) {
      // eslint-disable-next-line no-restricted-syntax
      void shell.openExternal(url, options);
    } else {
      logService.warning(`Blocked attempt to open unsafe external url: ${url}`);
    }
  }

  /**
   * Open the given external protocol URL in the desktop's default manner if it is considered safe. (For example, mailto: URLs in the user's default mail agent).
   */
  openExternal(url: string, options?: Electron.OpenExternalOptions): void {
    SafeShell.openExternal(url, this.logService, options);
  }
}
