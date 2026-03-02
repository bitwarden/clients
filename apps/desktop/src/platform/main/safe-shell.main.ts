import { shell } from "electron";

import { SafeUrls } from "@bitwarden/common/platform/misc/safe-urls";
import { LogService } from "@bitwarden/logging";

/**
 * A wrapper around Electron's shell module with safe versions of methods for opening external URLs.
 */
export class SafeShell {
  constructor(private readonly logService: LogService) {}

  /**
   * Opens the given URL with the default system handler (e.g. browser) if it is considered safe, otherwise logs a warning.
   * This is the static version of the method, which can be used in contexts where an instance of SafeShell is not available.
   * In those cases, a LogService instance must be passed in to allow logging warnings for unsafe URLs.
   */
  static openExternal(url: string, logService: LogService): void {
    if (SafeUrls.canLaunch(url)) {
      void shell.openExternal(url);
    } else {
      logService.warning(`Blocked attempt to open unsafe external url: ${url}`);
    }
  }

  /**
   * Opens the given URL with the default system handler (e.g. browser) if it is considered safe, otherwise logs a warning.
   */
  openExternal(url: string): void {
    SafeShell.openExternal(url, this.logService);
  }
}
