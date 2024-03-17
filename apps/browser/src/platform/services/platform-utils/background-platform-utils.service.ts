import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { BrowserPlatformUtilsService } from "./browser-platform-utils.service";

export class BackgroundPlatformUtilsService extends BrowserPlatformUtilsService {
  constructor(
    private messagingService: MessagingService,
    clipboardWriteCallback: (clipboardValue: string, clearMs: number) => void,
    biometricCallback: () => Promise<boolean>,
    win: Window & typeof globalThis,
  ) {
    super(clipboardWriteCallback, biometricCallback, win);
  }

  override showToast(
    type: "error" | "success" | "warning" | "info",
    title: string,
    text: string | string[],
    options?: any,
  ): void {
    this.messagingService.send("showToast", {
      text: text,
      title: title,
      type: type,
      options: options,
    });
  }
}
