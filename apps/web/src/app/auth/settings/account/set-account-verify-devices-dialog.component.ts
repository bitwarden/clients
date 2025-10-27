import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { firstValueFrom, Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { UserVerificationFormInputComponent } from "@bitwarden/auth/angular";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { SetVerifyDevicesRequest } from "@bitwarden/common/auth/models/request/set-verify-devices.request";
import { TwoFactorApiService } from "@bitwarden/common/auth/two-factor";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  CalloutModule,
  DialogModule,
  DialogService,
  FormFieldModule,
  IconButtonModule,
  RadioButtonModule,
  SelectModule,
  ToastService,
} from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "./set-account-verify-devices-dialog.component.html",
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    FormFieldModule,
    AsyncActionsModule,
    ButtonModule,
    IconButtonModule,
    SelectModule,
    CalloutModule,
    RadioButtonModule,
    DialogModule,
    UserVerificationFormInputComponent,
  ],
})
export class SetAccountVerifyDevicesDialogComponent implements OnInit, OnDestroy {
  // use this subject for all subscriptions to ensure all subscripts are completed
  private destroy$ = new Subject<void>();
  // the default for new device verification is true
  verifyNewDeviceLogin: boolean = true;
  has2faConfigured: boolean = false;

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
    private twoFactorApiService: TwoFactorApiService,
  ) {
    this.accountService.accountVerifyNewDeviceLogin$
      .pipe(takeUntil(this.destroy$))
      .subscribe((verifyDevices: boolean) => {
        this.verifyNewDeviceLogin = verifyDevices;
      });
  }

  async ngOnInit() {
    const twoFactorProviders = await this.twoFactorApiService.getTwoFactorProviders();
    this.has2faConfigured = twoFactorProviders.data.length > 0;
  }

  submit = async () => {
    try {
      const activeAccount = await firstValueFrom(
        this.accountService.activeAccount$.pipe(takeUntil(this.destroy$)),
      );
      const verification: Verification = this.setVerifyDevicesForm.value.verification!;
      const request: SetVerifyDevicesRequest = await this.userVerificationService.buildRequest(
        verification,
        SetVerifyDevicesRequest,
      );
      // set verify device opposite what is currently is.
      request.verifyDevices = !this.verifyNewDeviceLogin;
      await this.accountApiService.setVerifyDevices(request);
      await this.accountService.setAccountVerifyNewDeviceLogin(
        activeAccount!.id,
        request.verifyDevices,
      );
      this.dialogRef.close();
      this.toastService.showToast({
        variant: "success",
        title: "",
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
