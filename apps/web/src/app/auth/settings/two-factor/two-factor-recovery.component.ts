// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogConfig } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";

import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TwoFactorRecoverResponse } from "@bitwarden/common/auth/models/response/two-factor-recover.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService } from "@bitwarden/components";

@Component({
  selector: "app-two-factor-recovery",
  templateUrl: "two-factor-recovery.component.html",
})
export class TwoFactorRecoveryComponent {
  type = -1;
  code: string;
  authed: boolean;
  twoFactorProviderType = TwoFactorProviderType;

  constructor(
    @Inject(DIALOG_DATA) protected data: any,
    private i18nService: I18nService,
  ) {
    this.auth(data.response);
  }

  auth(authResponse: any) {
    this.authed = true;
    this.processResponse(authResponse.response);
  }

  print() {
    const w = window.open();
    w.document.write(
      '<div style="font-size: 18px; text-align: center;">' +
        "<p>" +
        this.i18nService.t("twoFactorRecoveryYourCode") +
        ":</p>" +
        "<code style=\"font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;\">" +
        this.code +
        "</code></div>" +
        '<p style="text-align: center;">' +
        new Date() +
        "</p>",
    );
    w.onafterprint = () => w.close();
    w.print();
  }

  private formatString(s: string) {
    if (s == null) {
      return null;
    }
    return s
      .replace(/(.{4})/g, "$1 ")
      .trim()
      .toUpperCase();
  }

  private processResponse(response: TwoFactorRecoverResponse) {
    this.code = this.formatString(response.code);
  }

  static open(dialogService: DialogService, config: DialogConfig<any>) {
    return dialogService.open(TwoFactorRecoveryComponent, config);
  }
}
