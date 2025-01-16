import { DialogRef } from "@angular/cdk/dialog";
import { Component, OnDestroy } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";

import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { SetVerifyDevicesRequest } from "@bitwarden/common/auth/models/request/set-verify-devices.request";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { DialogService, ToastService } from "@bitwarden/components";

@Component({
  templateUrl: "./set-account-verify-devices-dialog.component.html",
})
export class SetAccountVerifyDevicesDialogComponent implements OnDestroy {
  // use this subject for all subscriptions to ensure all subscripts are completed
  private destroy$ = new Subject<void>();
  // the default for new device verification is true
  verifyNewDeviceLogin: boolean = true;
  activeUserId: UserId = null;

  setVerifyDevicesForm = this.formBuilder.group({
    verification: undefined as Verification | undefined,
  });
  invalidSecret: boolean = false;

  constructor(
    private i18nService: I18nService,
    private formBuilder: FormBuilder,
    private accountApiService: AccountApiService,
    private accountService: AccountService,
    private userVerificationService: UserVerificationService,
    private dialogRef: DialogRef,
    private toastService: ToastService,
  ) {
    this.accountService.accountVerifyDevices$
      .pipe(takeUntil(this.destroy$))
      .subscribe((verifyDevices: boolean) => {
        this.verifyNewDeviceLogin = verifyDevices;
      });
    this.accountService.activeAccount$
      .pipe(takeUntil(this.destroy$))
      .subscribe((account: Account) => (this.activeUserId = account.id));
  }

  submit = async () => {
    try {
      const verification = this.setVerifyDevicesForm.get("verification")?.value;
      const request: SetVerifyDevicesRequest = await this.userVerificationService.buildRequest(
        verification,
        SetVerifyDevicesRequest,
      );
      // set verify device opposite what is currently is.
      request.verifyDevices = !this.verifyNewDeviceLogin;

      await this.accountApiService.setVerifyDevices(request);
      await this.accountService.setAccountVerifyDevices(this.activeUserId, request.verifyDevices);
      this.dialogRef.close();
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("accountNewDeviceLoginProtectionSaved"),
      });
    } catch (e) {
      if (e instanceof ErrorResponse && e.statusCode === 400) {
        this.invalidSecret = true;
      }
      throw e;
    }
  };

  static open(dialogService: DialogService) {
    return dialogService.open(SetAccountVerifyDevicesDialogComponent);
  }

  // closes subscription leaks
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
