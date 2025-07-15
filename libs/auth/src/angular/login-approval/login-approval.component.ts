// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnInit, OnDestroy, Inject } from "@angular/core";
import { Subject, firstValueFrom, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AuthRequestServiceAbstraction,
  LoginApprovalComponentServiceAbstraction as LoginApprovalComponentService,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DevicesServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices/devices.service.abstraction";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  DIALOG_DATA,
  DialogRef,
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogService,
  ToastService,
} from "@bitwarden/components";

const RequestTimeOut = 60000 * 15; //15 Minutes
const RequestTimeUpdate = 60000 * 5; //5 Minutes

export interface LoginApprovalDialogParams {
  notificationId: string;
}

@Component({
  selector: "login-approval",
  templateUrl: "login-approval.component.html",
  imports: [CommonModule, AsyncActionsModule, ButtonModule, DialogModule, JslibModule],
})
export class LoginApprovalComponent implements OnInit, OnDestroy {
  loading = true;

  notificationId: string;

  private destroy$ = new Subject<void>();

  email: string;
  fingerprintPhrase: string;
  authRequestResponse: AuthRequestResponse;
  readableDeviceTypeName: string;
  interval: NodeJS.Timeout;
  requestTimeText: string;

  constructor(
    @Inject(DIALOG_DATA) private params: LoginApprovalDialogParams,
    private accountService: AccountService,
    private apiService: ApiService,
    private authRequestService: AuthRequestServiceAbstraction,
    private devicesService: DevicesServiceAbstraction,
    private dialogRef: DialogRef,
    private i18nService: I18nService,
    private loginApprovalComponentService: LoginApprovalComponentService,
    private toastService: ToastService,
    private validationService: ValidationService,
  ) {
    this.notificationId = params.notificationId;
  }

  async ngOnDestroy(): Promise<void> {
    clearInterval(this.interval);
    this.destroy$.next();
    this.destroy$.complete();
  }

  async ngOnInit() {
    if (this.notificationId != null) {
      try {
        this.authRequestResponse = await this.apiService.getAuthRequest(this.notificationId);
      } catch (error) {
        this.validationService.showError(error);
      }

      const publicKey = Utils.fromB64ToArray(this.authRequestResponse.publicKey);

      this.email = await firstValueFrom(
        this.accountService.activeAccount$.pipe(map((a) => a?.email)),
      );

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

      await this.loginApprovalComponentService.showLoginRequestedAlertIfWindowNotVisible(
        this.email,
      );

      this.loading = false;
    }
  }

  /**
   * Strongly-typed helper to open a LoginApprovalDialog
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param data Configuration for the dialog
   */
  static open(dialogService: DialogService, data: LoginApprovalDialogParams) {
    return dialogService.open(LoginApprovalComponent, { data });
  }

  denyLogin = async () => {
    await this.retrieveAuthRequestAndRespond(false);
  };

  approveLogin = async () => {
    await this.retrieveAuthRequestAndRespond(true);
  };

  private async retrieveAuthRequestAndRespond(approve: boolean) {
    this.authRequestResponse = await this.apiService.getAuthRequest(this.notificationId);
    if (this.authRequestResponse.requestApproved || this.authRequestResponse.responseDate != null) {
      this.toastService.showToast({
        variant: "info",
        title: null,
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
        title: "",
        message: this.i18nService.t(
          "loginRequestApprovedForEmailOnDevice",
          this.email,
          this.devicesService.getReadableDeviceTypeName(loginResponse.requestDeviceTypeValue),
        ),
      });
    } else {
      this.toastService.showToast({
        variant: "info",
        title: "",
        message: this.i18nService.t("youDeniedLoginAttemptFromAnotherDevice"),
      });
    }
  }

  updateTimeText() {
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
        title: null,
        message: this.i18nService.t("loginRequestHasAlreadyExpired"),
      });
    }
  }
}
