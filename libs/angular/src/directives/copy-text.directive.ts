// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, ElementRef, HostListener, Input } from "@angular/core";

import { ClientType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

@Directive({
  selector: "[appCopyText]",
  standalone: false,
})
export class CopyTextDirective {
  constructor(
    private el: ElementRef,
    private platformUtilsService: PlatformUtilsService,
  ) {}

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input("appCopyText") copyText: string;

  @HostListener("copy") onCopy() {
    if (window == null) {
      return;
    }

    const timeout = this.platformUtilsService.getClientType() === ClientType.Desktop ? 100 : 0;
    setTimeout(() => {
      this.platformUtilsService.copyToClipboard(this.copyText, { window: window });
    }, timeout);
  }
}
