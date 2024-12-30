// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { DatePipe } from "@angular/common";
import { Component, Inject } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { AddEditComponent as BaseAddEditComponent } from "@bitwarden/angular/tools/send/add-edit.component";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";

@Component({
  selector: "app-send-add-edit",
  templateUrl: "add-edit.component.html",
})
export class AddEditComponent extends BaseAddEditComponent {
  override componentName = "app-send-add-edit";
  protected selectedFile: File;

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
    protected dialogRef: DialogRef,
    @Inject(DIALOG_DATA) params: { sendId: string },
    accountService: AccountService,
    toastService: ToastService,
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
    );

    this.sendId = params.sendId;
  }

  async copyLinkToClipboard(link: string): Promise<void | boolean> {
    // Copy function on web depends on the modal being open or not. Since this event occurs during a transition
    // of the modal closing we need to add a small delay to make sure state of the DOM is consistent.
    return new Promise((resolve) => {
      window.setTimeout(() => resolve(super.copyLinkToClipboard(link)), 500);
    });
  }

  protected setSelectedFile(event: Event) {
    const fileInputEl = <HTMLInputElement>event.target;
    const file = fileInputEl.files.length > 0 ? fileInputEl.files[0] : null;
    this.selectedFile = file;
  }

  submitAndClose = async () => {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const success = await this.submit();
    if (success) {
      this.dialogRef.close();
    }
  };

  deleteAndClose = async () => {
    const success = await this.delete();
    if (success) {
      this.dialogRef.close();
    }
  };
}
