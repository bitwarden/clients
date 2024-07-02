import { ToastService } from "@bitwarden/components";

import { OffscreenDocumentService } from "../../offscreen-document/abstractions/offscreen-document";

import { BrowserPlatformUtilsService } from "./browser-platform-utils.service";

export class ForegroundPlatformUtilsService extends BrowserPlatformUtilsService {
  constructor(
    private toastService: ToastService,
    clipboardWriteCallback: (clipboardValue: string, clearMs: number) => void,
    biometricCallback: () => Promise<boolean>,
    biometricUnlockAvailableCallback: () => Promise<boolean>,
    win: Window & typeof globalThis,
    offscreenDocumentService: OffscreenDocumentService,
  ) {
    super(
      clipboardWriteCallback,
      biometricCallback,
      biometricUnlockAvailableCallback,
      win,
      offscreenDocumentService,
    );
  }

  override showToast(
    type: "error" | "success" | "warning" | "info",
    title: string,
    text: string | string[],
    options?: any,
  ): void {
    this.toastService._showToast({ type, title, text, options });
  }
}
