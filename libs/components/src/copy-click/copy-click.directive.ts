// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, HostListener, Input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { ToastService, ToastVariant } from "../";

@Directive({
  selector: "[appCopyClick]",
})
export class CopyClickDirective {
  private _showToast = false;
  private toastVariant: ToastVariant = "success";

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {}

  @Input("appCopyClick") valueToCopy = "";

  /**
   * When set, the toast displayed will show `<valueLabel> copied`
   * instead of the default messaging.
   */
  @Input() valueLabel: string;

  /**
   * When set without a value, a success toast will be shown when the value is copied
   * @example
   * ```html
   *  <app-component [appCopyClick]="value to copy" showToast/></app-component>
   * ```
   * When set with a value, a toast with the specified variant will be shown when the value is copied
   *
   * @example
   * ```html
   *  <app-component [appCopyClick]="value to copy" showToast="info"/></app-component>
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
      const message = this.valueLabel
        ? this.i18nService.t("valueCopied", this.valueLabel)
        : this.i18nService.t("copySuccessful");

      this.toastService.showToast({
        variant: this.toastVariant,
        title: null,
        message,
      });
    }
  }
}
