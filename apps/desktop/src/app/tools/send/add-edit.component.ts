// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule, DatePipe } from "@angular/common";
import { Component } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AddEditComponent as BaseAddEditComponent } from "@bitwarden/angular/tools/send/add-edit.component";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CalloutModule, DialogService, ToastService } from "@bitwarden/components";

import { DesktopPremiumUpgradePromptService } from "../../../services/desktop-premium-upgrade-prompt.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-send-add-edit",
  templateUrl: "add-edit.component.html",
  imports: [CommonModule, JslibModule, ReactiveFormsModule, CalloutModule],
  providers: [
    {
      provide: PremiumUpgradePromptService,
      useClass: DesktopPremiumUpgradePromptService,
    },
  ],
})
export class AddEditComponent extends BaseAddEditComponent {
  constructor(
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    environmentService: EnvironmentService,
    datePipe: DatePipe,
    sendService: SendService,
    stateService: StateService,
    messagingService: MessagingService,
    policyService: PolicyService,
    logService: LogService,
    sendApiService: SendApiService,
    dialogService: DialogService,
    formBuilder: FormBuilder,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    accountService: AccountService,
    toastService: ToastService,
    premiumUpgradePromptService: PremiumUpgradePromptService,
  ) {
    super(
      i18nService,
      platformUtilsService,
      environmentService,
      datePipe,
      sendService,
      messagingService,
      policyService,
      logService,
      stateService,
      sendApiService,
      dialogService,
      formBuilder,
      billingAccountProfileStateService,
      accountService,
      toastService,
      premiumUpgradePromptService,
    );
  }

  async refresh() {
    const send = await this.loadSend();
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    this.send = await send.decrypt(userId);
    this.updateFormValues();
    this.hasPassword = this.send.password != null && this.send.password.trim() !== "";
  }

  cancel() {
    this.onCancelled.emit(this.send);
  }

  async copyLinkToClipboard(link: string) {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    super.copyLinkToClipboard(link);
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("valueCopied", this.i18nService.t("sendLink")),
    });
  }

  async resetAndLoad() {
    this.sendId = null;
    this.send = null;
    await this.load();
    this.updateFormValues();
  }
}
