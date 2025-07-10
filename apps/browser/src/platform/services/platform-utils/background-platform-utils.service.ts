import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { OffscreenDocumentService } from "../../offscreen-document/abstractions/offscreen-document";

import { BrowserPlatformUtilsService } from "./browser-platform-utils.service";

export class BackgroundPlatformUtilsService extends BrowserPlatformUtilsService {
  constructor(
    private messagingService: MessagingService,
    clipboardWriteCallback: (clipboardValue: string, clearMs: number) => void,
    win: Window & typeof globalThis,
    offscreenDocumentService: OffscreenDocumentService,
  ) {
    super(clipboardWriteCallback, win, offscreenDocumentService);
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
