// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendAccessView } from "@bitwarden/common/tools/send/models/view/send-access.view";
import { ToastService } from "@bitwarden/components";

import { SharedModule } from "../../../shared";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-send-access-text",
  templateUrl: "send-access-text.component.html",
  imports: [SharedModule],
})
export class SendAccessTextComponent {
  private _send: SendAccessView = null;
  protected showText = false;

  protected formGroup = this.formBuilder.group({
    sendText: [""],
  });

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private formBuilder: FormBuilder,
    private toastService: ToastService,
  ) {}

  get send(): SendAccessView {
    return this._send;
  }

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() set send(value: SendAccessView) {
    this._send = value;
    this.showText = this.send.text != null ? !this.send.text.hidden : true;

    if (this.send == null || this.send.text == null) {
      return;
    }

    this.formGroup.controls.sendText.patchValue(
      this.showText ? this.send.text.text : this.send.text.maskedText,
    );
  }

  protected copyText() {
    this.platformUtilsService.copyToClipboard(this.send.text.text);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("valueCopied", this.i18nService.t("sendTypeText")),
    });
  }

  protected toggleText() {
    this.showText = !this.showText;
    this.formGroup.controls.sendText.patchValue(
      this.showText ? this.send.text.text : this.send.text.maskedText,
    );
  }
}
