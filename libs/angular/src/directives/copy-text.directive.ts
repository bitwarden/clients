import { Directive, ElementRef, HostListener, Input } from "@angular/core";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

@Directive({
  selector: "[appCopyText]",
})
export class CopyTextDirective {
  constructor(private el: ElementRef, private platformUtilsService: PlatformUtilsService) {}

  @Input("appCopyText") copyText: string;

  @HostListener("copy") onCopy() {
    if (window == null) {
      return;
    }

    this.platformUtilsService.copyToClipboard(this.copyText, { window: window });
  }
}
