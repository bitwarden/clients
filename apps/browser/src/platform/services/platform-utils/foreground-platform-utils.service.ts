import { ToastService } from "@bitwarden/components";

import { BrowserPlatformUtilsService } from "./browser-platform-utils.service";

export class ForegroundPlatformUtilsService extends BrowserPlatformUtilsService {
  constructor(
    private toastService: ToastService,
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
    this.toastService._showToast({ type, title, text, options });
  }
}
