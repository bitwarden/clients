import { CommonModule } from "@angular/common";
import { Component, OnInit, OnDestroy, Inject } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { AuthRequestServiceAbstraction } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

import { LoginApprovalDialogComponentServiceAbstraction } from "./login-approval-dialog-component.service.abstraction";

const RequestTimeOut = 60000 * 15; // 15 Minutes
const RequestTimeUpdate = 60000 * 5; // 5 Minutes

export interface LoginApprovalDialogParams {
  notificationId: string;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "login-approval-dialog.component.html",
  imports: [AsyncActionsModule, ButtonModule, CommonModule, DialogModule, JslibModule],
})
export class LoginApprovalDialogComponent implements OnInit, OnDestroy {
  authRequestId: string;
  authRequestResponse?: AuthRequestResponse;
  email?: string;
  fingerprintPhrase?: string;
  interval?: NodeJS.Timeout;
  loading = true;
  readableDeviceTypeName?: string;
  requestTimeText?: string;

  constructor(
    @Inject(DIALOG_DATA) private params: LoginApprovalDialogParams,
    private accountService: AccountService,
    private apiService: ApiService,
    private authRequestService: AuthRequestServiceAbstraction,
    private devicesService: DevicesServiceAbstraction,
    private dialogRef: DialogRef,
    private i18nService: I18nService,
    private loginApprovalDialogComponentService: LoginApprovalDialogComponentServiceAbstraction,
    private logService: LogService,
    private toastService: ToastService,
    private validationService: ValidationService,
  ) {
    this.authRequestId = params.notificationId;
  }

  async ngOnDestroy(): Promise<void> {
    clearInterval(this.interval);
  }

  async ngOnInit() {
    if (this.authRequestId == null) {
      this.logService.error("LoginApprovalDialogComponent: authRequestId is null");
      return;
    }

    try {
      this.authRequestResponse = await this.apiService.getAuthRequest(this.authRequestId);
    } catch (error) {
      this.validationService.showError(error);
      this.logService.error("LoginApprovalDialogComponent: getAuthRequest error", error);
    }

    if (this.authRequestResponse == null) {
      this.logService.error("LoginApprovalDialogComponent: authRequestResponse not found");
      return;
    }

    const publicKey = Utils.fromB64ToArray(this.authRequestResponse.publicKey);

    this.email = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.email)),
    );

    if (!this.email) {
      this.logService.error("LoginApprovalDialogComponent: email not found");
      return;
    }

    this.fingerprintPhrase = await this.authRequestService.getFingerprintPhrase(
      this.email,
      publicKey,
    );

    this.readableDeviceTypeName = this.devicesService.getReadableDeviceTypeName(
      this.authRequestResponse.requestDeviceTypeValue,
    );

    this.updateTimeText();

    this.interval = setInterval(() => {
      this.updateTimeText();
    }, RequestTimeUpdate);

    await this.loginApprovalDialogComponentService.showLoginRequestedAlertIfWindowNotVisible(
      this.email,
    );

    this.loading = false;
  }

  /**
   * Strongly-typed helper to open a LoginApprovalDialog
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param data Configuration for the dialog
   */
  static open(dialogService: DialogService, data: LoginApprovalDialogParams) {
    return dialogService.open(LoginApprovalDialogComponent, { data });
  }

  denyLogin = async () => {
    await this.retrieveAuthRequestAndRespond(false);
  };

  approveLogin = async () => {
    await this.retrieveAuthRequestAndRespond(true);
  };

  private async retrieveAuthRequestAndRespond(approve: boolean) {
    this.authRequestResponse = await this.apiService.getAuthRequest(this.authRequestId);
    if (this.authRequestResponse.requestApproved || this.authRequestResponse.responseDate != null) {
      this.toastService.showToast({
        variant: "info",
        message: this.i18nService.t("thisRequestIsNoLongerValid"),
      });
    } else {
      const loginResponse = await this.authRequestService.approveOrDenyAuthRequest(
        approve,
        this.authRequestResponse,
      );
      this.showResultToast(loginResponse);
    }

    this.dialogRef.close(approve);
  }

  showResultToast(loginResponse: AuthRequestResponse) {
    if (loginResponse.requestApproved) {
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(
          "loginRequestApprovedForEmailOnDevice",
          this.email,
          this.devicesService.getReadableDeviceTypeName(loginResponse.requestDeviceTypeValue),
        ),
      });
    } else {
      this.toastService.showToast({
        variant: "info",
        message: this.i18nService.t("youDeniedLoginAttemptFromAnotherDevice"),
      });
    }
  }

  updateTimeText() {
    if (this.authRequestResponse == null) {
      this.logService.error("LoginApprovalDialogComponent: authRequestResponse not found");
      return;
    }

    const requestDate = new Date(this.authRequestResponse.creationDate);
    const requestDateUTC = Date.UTC(
      requestDate.getUTCFullYear(),
      requestDate.getUTCMonth(),
      requestDate.getDate(),
      requestDate.getUTCHours(),
      requestDate.getUTCMinutes(),
      requestDate.getUTCSeconds(),
      requestDate.getUTCMilliseconds(),
    );

    const dateNow = new Date(Date.now());
    const dateNowUTC = Date.UTC(
      dateNow.getUTCFullYear(),
      dateNow.getUTCMonth(),
      dateNow.getDate(),
      dateNow.getUTCHours(),
      dateNow.getUTCMinutes(),
      dateNow.getUTCSeconds(),
      dateNow.getUTCMilliseconds(),
    );

    const diffInMinutes = dateNowUTC - requestDateUTC;

    if (diffInMinutes <= RequestTimeUpdate) {
      this.requestTimeText = this.i18nService.t("justNow");
    } else if (diffInMinutes < RequestTimeOut) {
      this.requestTimeText = this.i18nService.t(
        "requestedXMinutesAgo",
        (diffInMinutes / 60000).toFixed(),
      );
    } else {
      clearInterval(this.interval);
      this.dialogRef.close();
      this.toastService.showToast({
        variant: "info",
        message: this.i18nService.t("loginRequestHasAlreadyExpired"),
      });
    }
  }
}
