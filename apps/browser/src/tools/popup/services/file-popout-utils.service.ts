import { Injectable } from "@angular/core";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";

/**
 * Service for determining whether to display file popout callout messages.
 */
@Injectable()
export class FilePopoutUtilsService {
  /**
   * Creates an instance of FilePopoutUtilsService.
   */
  constructor(private platformUtilsService: PlatformUtilsService) {}

  /**
   * Determines whether to show any file popout callout message in the current browser.
   * @param win - The window context in which the check should be performed.
   * @returns True if a file popout callout message should be displayed; otherwise, false.
   */
  showFilePopoutMessage(win: Window): boolean {
    return (
      this.showFirefoxFileWarning(win) ||
      this.showSafariFileWarning(win) ||
      this.showChromiumFileWarning(win)
    );
  }

  /**
   * Determines whether to show a file popout callout message for the Firefox browser
   * @param win - The window context in which the check should be performed.
   * @returns True if the extension is not in a sidebar or popout; otherwise, false.
   */
  showFirefoxFileWarning(win: Window): boolean {
    return (
      this.platformUtilsService.isFirefox() &&
      !(BrowserPopupUtils.inSidebar(win) || BrowserPopupUtils.inPopout(win))
    );
  }

  /**
   * Determines whether to show a file popout message for the Safari browser
   * @param win - The window context in which the check should be performed.
   * @returns True if the extension is not in a popout; otherwise, false.
   */
  showSafariFileWarning(win: Window): boolean {
    return this.platformUtilsService.isSafari() && !BrowserPopupUtils.inPopout(win);
  }

  /**
   * Determines whether to show a file popout callout message for Chromium-based browsers in Linux and Mac OS X
   * @param win - The window context in which the check should be performed.
   * @returns True if the extension is not in a sidebar or popout; otherwise, false.
   */
  showChromiumFileWarning(win: Window): boolean {
    return (
      (this.isLinux(win) || this.isUnsupportedMac(win)) &&
      !this.platformUtilsService.isFirefox() &&
      !(BrowserPopupUtils.inSidebar(win) || BrowserPopupUtils.inPopout(win))
    );
  }

  private isLinux(win: Window): boolean {
    return win?.navigator?.userAgent.indexOf("Linux") !== -1;
  }

  private isUnsupportedMac(win: Window): boolean {
    return this.platformUtilsService.isChrome() && win?.navigator?.appVersion.includes("Mac OS X");
  }
}
