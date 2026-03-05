import { CommonModule } from "@angular/common";
import { Component, Inject } from "@angular/core";

import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TwoFactorRecoverResponse } from "@bitwarden/common/auth/models/response/two-factor-recover.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-two-factor-recovery",
  templateUrl: "two-factor-recovery.component.html",
  imports: [CommonModule, DialogModule, ButtonModule, TypographyModule, I18nPipe],
})
export class TwoFactorRecoveryComponent {
  type = -1;
  code: string = "";
  authed: boolean = false;
  twoFactorProviderType = TwoFactorProviderType;

  constructor(
    @Inject(DIALOG_DATA) protected data: { response: { response: TwoFactorRecoverResponse } },
    private i18nService: I18nService,
  ) {
    this.auth(data.response);
  }

  auth(authResponse: { response: TwoFactorRecoverResponse }) {
    this.authed = true;
    this.processResponse(authResponse.response);
  }

  print() {
    const w = window.open();
    if (!w) {
      // return early if the window is not open
      return;
    }
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

  private formatString(s: string): string {
    if (s == null) {
      return "";
    }
    return s
      .replace(/(.{4})/g, "$1 ")
      .trim()
      .toUpperCase();
  }

  private processResponse(response: TwoFactorRecoverResponse) {
    this.code = this.formatString(response.code);
  }

  static open(
    dialogService: DialogService,
    config: DialogConfig<
      { response: { response: TwoFactorRecoverResponse } },
      DialogRef<unknown, TwoFactorRecoveryComponent>
    >,
  ) {
    return dialogService.open(TwoFactorRecoveryComponent, config);
  }
}
