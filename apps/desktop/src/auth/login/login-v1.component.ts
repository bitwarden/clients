// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, NgZone, OnDestroy, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Subject, firstValueFrom, takeUntil, tap } from "rxjs";

import { LoginComponentV1 as BaseLoginComponent } from "@bitwarden/angular/auth/components/login-v1.component";
import { FormValidationErrorsService } from "@bitwarden/angular/platform/abstractions/form-validation-errors.service";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import {
  LoginStrategyServiceAbstraction,
  LoginEmailServiceAbstraction,
} from "@bitwarden/auth/common";
import { DevicesApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices-api.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { EnvironmentComponent } from "../environment.component";

const BroadcasterSubscriptionId = "LoginComponent";

@Component({
  selector: "app-login",
  templateUrl: "login-v1.component.html",
})
export class LoginComponentV1 extends BaseLoginComponent implements OnInit, OnDestroy {
  @ViewChild("environment", { read: ViewContainerRef, static: true })
  environmentModal: ViewContainerRef;

  protected componentDestroyed$: Subject<void> = new Subject();
  webVaultHostname = "";

  showingModal = false;

  private deferFocus: boolean = null;

  get loggedEmail() {
    return this.formGroup.value.email;
  }

  constructor(
    devicesApiService: DevicesApiServiceAbstraction,
    appIdService: AppIdService,
    loginStrategyService: LoginStrategyServiceAbstraction,
    router: Router,
    i18nService: I18nService,
    syncService: SyncService,
    private modalService: ModalService,
    platformUtilsService: PlatformUtilsService,
    stateService: StateService,
    environmentService: EnvironmentService,
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    cryptoFunctionService: CryptoFunctionService,
    private broadcasterService: BroadcasterService,
    ngZone: NgZone,
    private messagingService: MessagingService,
    logService: LogService,
    formBuilder: FormBuilder,
    formValidationErrorService: FormValidationErrorsService,
    route: ActivatedRoute,
    loginEmailService: LoginEmailServiceAbstraction,
    ssoLoginService: SsoLoginServiceAbstraction,
    toastService: ToastService,
    private configService: ConfigService,
  ) {
    super(
      devicesApiService,
      appIdService,
      loginStrategyService,
      router,
      platformUtilsService,
      i18nService,
      stateService,
      environmentService,
      passwordGenerationService,
      cryptoFunctionService,
      logService,
      ngZone,
      formBuilder,
      formValidationErrorService,
      route,
      loginEmailService,
      ssoLoginService,
      toastService,
    );
    this.onSuccessfulLogin = () => {
      return syncService.fullSync(true);
    };
  }

  async ngOnInit() {
    this.listenForUnauthUiRefreshFlagChanges();

    await super.ngOnInit();
    await this.getLoginWithDevice(this.loggedEmail);
    this.broadcasterService.subscribe(BroadcasterSubscriptionId, async (message: any) => {
      this.ngZone.run(() => {
        switch (message.command) {
          case "windowHidden":
            this.onWindowHidden();
            break;
          case "windowIsFocused":
            if (this.deferFocus === null) {
              this.deferFocus = !message.windowIsFocused;
              if (!this.deferFocus) {
                this.focusInput();
              }
            } else if (this.deferFocus && message.windowIsFocused) {
              this.focusInput();
              this.deferFocus = false;
            }
            break;
          default:
        }
      });
    });
    this.messagingService.send("getWindowIsFocused");
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    this.componentDestroyed$.next();
    this.componentDestroyed$.complete();
  }

  private listenForUnauthUiRefreshFlagChanges() {
    this.configService
      .getFeatureFlag$(FeatureFlag.UnauthenticatedExtensionUIRefresh)
      .pipe(
        tap(async (flag) => {
          if (flag) {
            const qParams = await firstValueFrom(this.route.queryParams);

            const uniqueQueryParams = {
              ...qParams,
              // adding a unique timestamp to the query params to force a reload
              t: new Date().getTime().toString(),
            };

            await this.router.navigate(["/"], {
              queryParams: uniqueQueryParams,
            });
          }
        }),
        takeUntil(this.componentDestroyed$),
      )
      .subscribe();
  }

  async settings() {
    const [modal, childComponent] = await this.modalService.openViewRef(
      EnvironmentComponent,
      this.environmentModal,
    );

    modal.onShown.pipe(takeUntil(this.componentDestroyed$)).subscribe(() => {
      this.showingModal = true;
    });

    modal.onClosed.pipe(takeUntil(this.componentDestroyed$)).subscribe(() => {
      this.showingModal = false;
    });

    // eslint-disable-next-line rxjs/no-async-subscribe
    childComponent.onSaved.pipe(takeUntil(this.componentDestroyed$)).subscribe(async () => {
      modal.close();
      await this.getLoginWithDevice(this.loggedEmail);
    });
  }

  onWindowHidden() {
    this.showPassword = false;
  }

  async continue() {
    await super.validateEmail();
    if (!this.formGroup.controls.email.valid) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccured"),
        message: this.i18nService.t("invalidEmail"),
      });
      return;
    }
    this.focusInput();
  }

  async submit() {
    if (!this.validatedEmail) {
      return;
    }

    await super.submit();
    if (this.captchaSiteKey) {
      const content = document.getElementById("content") as HTMLDivElement;
      content.setAttribute("style", "width:335px");
    }
  }

  private focusInput() {
    const email = this.loggedEmail;
    document.getElementById(email == null || email === "" ? "email" : "masterPassword")?.focus();
  }

  async launchSsoBrowser(clientId: string, ssoRedirectUri: string) {
    if (!ipc.platform.isAppImage && !ipc.platform.isSnapStore && !ipc.platform.isDev) {
      return super.launchSsoBrowser(clientId, ssoRedirectUri);
    }
    const email = this.formGroup.controls.email.value;

    // Save off email for SSO
    await this.ssoLoginService.setSsoEmail(email);

    // Generate necessary sso params
    const passwordOptions: any = {
      type: "password",
      length: 64,
      uppercase: true,
      lowercase: true,
      numbers: true,
      special: false,
    };
    const state = await this.passwordGenerationService.generatePassword(passwordOptions);
    const ssoCodeVerifier = await this.passwordGenerationService.generatePassword(passwordOptions);
    const codeVerifierHash = await this.cryptoFunctionService.hash(ssoCodeVerifier, "sha256");
    const codeChallenge = Utils.fromBufferToUrlB64(codeVerifierHash);

    // Save sso params
    await this.ssoLoginService.setSsoState(state);
    await this.ssoLoginService.setCodeVerifier(ssoCodeVerifier);

    try {
      await ipc.platform.localhostCallbackService.openSsoPrompt(codeChallenge, state, email);
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccured"),
        this.i18nService.t("ssoError"),
      );
    }
  }

  /**
   * Force the validatedEmail flag to false, which will show the login page.
   */
  invalidateEmail() {
    this.validatedEmail = false;
  }
}
