import { DatePipe } from "@angular/common";
import { Component } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { AddEditComponent as BaseAddEditComponent } from "@bitwarden/angular/tools/send/add-edit.component";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { DialogService } from "@bitwarden/components";

@Component({
  selector: "app-send-add-edit",
  templateUrl: "add-edit.component.html",
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
    formBuilder: FormBuilder
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
      formBuilder
    );
  }

  async refresh() {
    const send = await this.loadSend();
    this.send = await send.decrypt();
    this.updateFormValues();
    this.hasPassword = this.send.password != null && this.send.password.trim() !== "";
  }

  cancel() {
    this.onCancelled.emit(this.send);
  }

  async copyLinkToClipboard(link: string) {
    super.copyLinkToClipboard(link);
    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("valueCopied", this.i18nService.t("sendLink"))
    );
  }

  async resetAndLoad() {
    this.sendId = null;
    this.send = null;
    await this.load();
    this.updateFormValues();
  }
}
