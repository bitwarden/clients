import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { Directive, HostListener, Input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

@Directive({
  selector: "[appCopyClick]",
})
export class CopyClickDirective {
  constructor(
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {}

  @Input("appCopyClick") valueToCopy = "";
  @Input({ transform: coerceBooleanProperty }) showToast?: boolean;

  @HostListener("click") onClick() {
    this.platformUtilsService.copyToClipboard(this.valueToCopy);

    if (this.showToast) {
      this.toastService.showToast({
        variant: "info",
        title: null,
        message: this.i18nService.t("copySuccessful"),
      });
    }
  }
}
