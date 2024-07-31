import { Directive, HostListener, Input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import { ToastVariant } from "@bitwarden/components/src/toast/toast.component";

@Directive({
  selector: "[appCopyClick]",
})
export class CopyClickDirective {
  private _showToast = false;
  private toastVariant: ToastVariant = "info";

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {}

  @Input("appCopyClick") valueToCopy = "";

  /**
   * When set without a value, a info toast will be shown when the value is copied
   * @example
   * ```html
   *  <app-component [appCopyClick]="value to copy" showToast/></app-component>
   * ```
   * When set with a value, a toast with the specified variant will be shown when the value is copied
   *
   * @example
   * ```html
   *  <app-component [appCopyClick]="value to copy" showToast="success"/></app-component>
   * ```
   */
  @Input() set showToast(value: ToastVariant | "") {
    // When the `showToast` is set without a value, an empty string will be passed
    if (value === "") {
      this._showToast = true;
    } else {
      this._showToast = true;
      this.toastVariant = value;
    }
  }

  @HostListener("click") onClick() {
    this.platformUtilsService.copyToClipboard(this.valueToCopy);

    if (this._showToast) {
      this.toastService.showToast({
        variant: this.toastVariant,
        title: null,
        message: this.i18nService.t("copySuccessful"),
      });
    }
  }
}
