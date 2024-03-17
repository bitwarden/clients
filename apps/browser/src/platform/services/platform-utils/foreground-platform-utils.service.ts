import { SecurityContext } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import { ToastrService } from "ngx-toastr";

import { BrowserPlatformUtilsService } from "./browser-platform-utils.service";

export class ForegroundPlatformUtilsService extends BrowserPlatformUtilsService {
  constructor(
    private sanitizer: DomSanitizer,
    private toastrService: ToastrService,
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
    if (typeof text === "string") {
      // Already in the correct format
    } else if (text.length === 1) {
      text = text[0];
    } else {
      let message = "";
      text.forEach(
        (t: string) =>
          (message += "<p>" + this.sanitizer.sanitize(SecurityContext.HTML, t) + "</p>"),
      );
      text = message;
      options.enableHtml = true;
    }
    this.toastrService.show(text, title, options, "toast-" + type);
    // noop
  }
}
