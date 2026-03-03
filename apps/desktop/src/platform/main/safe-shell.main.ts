import { shell } from "electron";

import { SafeUrls, UrlType } from "@bitwarden/common/platform/misc/safe-urls";
import { LogService } from "@bitwarden/logging";

/**
 * A wrapper around Electron's shell module with safe versions of methods for opening external URLs.
 */
export class SafeShell {
  constructor(private readonly logService: LogService) {}

  /**
   * Open the given external protocol URL in the desktop's default manner if it is considered safe. (For example, mailto: URLs in the user's default mail agent).
   */
  openExternal(url: string, type: UrlType, options?: Electron.OpenExternalOptions): void {
    if (SafeUrls.canLaunch(url, type)) {
      // eslint-disable-next-line no-restricted-syntax
      void shell.openExternal(url, options);
    } else {
      this.logService.warning(`Blocked attempt to open unsafe external url: ${url}`);
    }
  }
}
