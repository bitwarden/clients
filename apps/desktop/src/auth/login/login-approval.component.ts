import { Component, OnInit, OnDestroy } from "@angular/core";
import { ipcRenderer } from "electron";
import { Subject } from "rxjs";

import { ModalRef } from "@bitwarden/angular/components/modal/modal.ref";
import { ModalConfig } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

const RequestTimeOut = 60000 * 15; //15 Minutes
const RequestTimeUpdate = 60000 * 5; //5 Minutes

@Component({
  selector: "login-approval",
  templateUrl: "login-approval.component.html",
})
export class LoginApprovalComponent implements OnInit, OnDestroy {
  notificationId: string;

  private destroy$ = new Subject<void>();

  email: string;
  fingerprintPhrase: string;
  authRequestResponse: AuthRequestResponse;
  interval: NodeJS.Timer;
  requestTimeText: string;
  dismissModal: boolean;

  constructor(
    protected stateService: StateService,
    protected platformUtilsService: PlatformUtilsService,
    protected i18nService: I18nService,
    protected apiService: ApiService,
    protected authService: AuthService,
    protected appIdService: AppIdService,
    protected cryptoService: CryptoService,
    private modalRef: ModalRef,
    config: ModalConfig
  ) {
    this.notificationId = config.data.notificationId;

    this.dismissModal = true;
    this.modalRef.onClosed
      // eslint-disable-next-line rxjs-angular/prefer-takeuntil
      .subscribe(() => {
        if (this.dismissModal) {
          this.approveLogin(false, false);
        }
      });
  }

  ngOnDestroy(): void {
    clearInterval(this.interval);
    this.destroy$.next();
    this.destroy$.complete();
  }

  async ngOnInit() {
    if (this.notificationId != null) {
      this.authRequestResponse = await this.apiService.getAuthRequest(this.notificationId);
      const publicKey = Utils.fromB64ToArray(this.authRequestResponse.publicKey);
      this.email = await this.stateService.getEmail();
      this.fingerprintPhrase = (
        await this.cryptoService.getFingerprint(this.email, publicKey)
      ).join("-");
      this.updateTimeText();

      this.interval = setInterval(() => {
        this.updateTimeText();
      }, RequestTimeUpdate);

      const isVisible = await ipcRenderer.invoke("windowVisible");
      if (!isVisible) {
        await ipcRenderer.invoke("loginRequest", {
          alertTitle: this.i18nService.t("logInRequested"),
          alertBody: this.i18nService.t("confirmLoginAtemptForMail", this.email),
          buttonText: this.i18nService.t("close"),
        });
      }
    }
  }

  async approveLogin(approveLogin: boolean, approveDenyButtonClicked: boolean) {
    clearInterval(this.interval);

    this.dismissModal = !approveDenyButtonClicked;
    if (approveDenyButtonClicked) {
      this.modalRef.close();
    }

    this.authRequestResponse = await this.apiService.getAuthRequest(this.notificationId);
    if (this.authRequestResponse.requestApproved || this.authRequestResponse.responseDate != null) {
      this.platformUtilsService.showToast(
        "info",
        null,
        this.i18nService.t("thisRequestIsNoLongerValid")
      );
    } else {
      const loginResponse = await this.authService.passwordlessLogin(
        this.authRequestResponse.id,
        this.authRequestResponse.publicKey,
        approveLogin
      );
      this.showResultToast(loginResponse);
    }
  }

  showResultToast(loginResponse: AuthRequestResponse) {
    if (loginResponse.requestApproved) {
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t(
          "logInConfirmedForEmailOnDevice",
          this.email,
          loginResponse.requestDeviceType
        )
      );
    } else {
      this.platformUtilsService.showToast(
        "info",
        null,
        this.i18nService.t("youDeniedALogInAttemptFromAnotherDevice")
      );
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
      requestDate.getUTCMilliseconds()
    );

    const dateNow = new Date(Date.now());
    const dateNowUTC = Date.UTC(
      dateNow.getUTCFullYear(),
      dateNow.getUTCMonth(),
      dateNow.getDate(),
      dateNow.getUTCHours(),
      dateNow.getUTCMinutes(),
      dateNow.getUTCSeconds(),
      dateNow.getUTCMilliseconds()
    );

    const diffInMinutes = dateNowUTC - requestDateUTC;

    if (diffInMinutes <= RequestTimeUpdate) {
      this.requestTimeText = this.i18nService.t("justNow");
    } else if (diffInMinutes < RequestTimeOut) {
      this.requestTimeText = this.i18nService.t(
        "requestedXMinutesAgo",
        (diffInMinutes / 60000).toFixed()
      );
    } else {
      clearInterval(this.interval);
      this.modalRef.close();
      this.platformUtilsService.showToast(
        "info",
        null,
        this.i18nService.t("loginRequestHasAlreadyExpired")
      );
    }
  }
}
