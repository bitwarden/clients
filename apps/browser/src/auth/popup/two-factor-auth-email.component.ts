import { DialogModule } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";

import { TwoFactorAuthEmailComponent as TwoFactorAuthEmailBaseComponent } from "@bitwarden/angular/auth/components/two-factor-auth/two-factor-auth-email.component";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { LoginStrategyServiceAbstraction } from "../../../../../libs/auth/src/common/abstractions";
import { AsyncActionsModule } from "../../../../../libs/components/src/async-actions";
import { ButtonModule } from "../../../../../libs/components/src/button";
import { DialogService } from "../../../../../libs/components/src/dialog";
import { FormFieldModule } from "../../../../../libs/components/src/form-field";
import { LinkModule } from "../../../../../libs/components/src/link";
import { I18nPipe } from "../../../../../libs/components/src/shared/i18n.pipe";
import { TypographyModule } from "../../../../../libs/components/src/typography";
import BrowserPopupUtils from "../../platform/popup/browser-popup-utils";

@Component({
  standalone: true,
  selector: "app-two-factor-auth-email",
  templateUrl:
    "../../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-email.component.html",
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    ButtonModule,
    LinkModule,
    TypographyModule,
    ReactiveFormsModule,
    FormFieldModule,
    AsyncActionsModule,
    FormsModule,
  ],
  providers: [I18nPipe],
})
export class TwoFactorAuthEmailComponent extends TwoFactorAuthEmailBaseComponent {
  constructor(
    protected i18nService: I18nService,
    protected twoFactorService: TwoFactorService,
    protected loginStrategyService: LoginStrategyServiceAbstraction,
    protected platformUtilsService: PlatformUtilsService,
    protected logService: LogService,
    protected apiService: ApiService,
    protected appIdService: AppIdService,
    protected dialogService: DialogService,
  ) {
    super(
      i18nService,
      twoFactorService,
      loginStrategyService,
      platformUtilsService,
      logService,
      apiService,
      appIdService,
    );
  }

  async ngOnInit(): Promise<void> {
    if (BrowserPopupUtils.inPopup(window)) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "warning" },
        content: { key: "popup2faCloseMessage" },
        type: "warning",
      });
      if (confirmed) {
        await BrowserPopupUtils.openCurrentPagePopout(window);
        return;
      }
    }

    await super.ngOnInit();
  }
}
