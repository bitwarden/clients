import { Directive, HostListener, Input, InjectionToken, Inject, Optional } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { ToastService, ToastVariant } from "../";

/**
 * Listener that can be provided to receive copy events to allow for customized behavior.
 */
export interface CopyClickListener {
  onCopy(value: string): void;
}

export const COPY_CLICK_LISTENER = new InjectionToken<CopyClickListener>("CopyClickListener");

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
    @Optional() @Inject(COPY_CLICK_LISTENER) private copyListener?: CopyClickListener,
  ) {}

  @Input("appCopyClick") valueToCopy = "";

  /**
   * When set, the toast displayed will show `<valueLabel> copied`
   * instead of the default messaging.
   */
  @Input() valueLabel?: string;

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

    if (this.copyListener) {
      this.copyListener.onCopy(this.valueToCopy);
    }

    if (this._showToast) {
      const message = this.valueLabel
        ? this.i18nService.t("valueCopied", this.valueLabel)
        : this.i18nService.t("copySuccessful");

      this.toastService.showToast({
        variant: this.toastVariant,
        message,
      });
    }
  }
}
