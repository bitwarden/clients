import { Component, Inject, NgZone, ViewChild, ViewContainerRef } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Subject, firstValueFrom, takeUntil } from "rxjs";

import { TwoFactorComponent as BaseTwoFactorComponent } from "@bitwarden/angular/auth/components/two-factor.component";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import {
  LoginStrategyServiceAbstraction,
  LoginEmailServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { TwoFactorOptionsComponent } from "./two-factor-options.component";

const BroadcasterSubscriptionId = "TwoFactorComponent";

@Component({
  selector: "app-two-factor",
  templateUrl: "two-factor.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class TwoFactorComponent extends BaseTwoFactorComponent {
  @ViewChild("twoFactorOptions", { read: ViewContainerRef, static: true })
  twoFactorOptionsModal: ViewContainerRef;

  private destroyed$: Subject<void> = new Subject();
  readonly TwoFactorWebauthnState = TwoFactorWebauthnState;

  showingModal = false;
  duoCallbackSubscriptionEnabled: boolean = false;
  webauthnState: TwoFactorWebauthnState = TwoFactorWebauthnState.Processing;
  pin?: string;

  constructor(
    loginStrategyService: LoginStrategyServiceAbstraction,
    router: Router,
    i18nService: I18nService,
    apiService: ApiService,
    platformUtilsService: PlatformUtilsService,
    syncService: SyncService,
    environmentService: EnvironmentService,
    private broadcasterService: BroadcasterService,
    private modalService: ModalService,
    stateService: StateService,
    private ngZone: NgZone,
    route: ActivatedRoute,
    logService: LogService,
    twoFactorService: TwoFactorService,
    appIdService: AppIdService,
    loginEmailService: LoginEmailServiceAbstraction,
    userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    ssoLoginService: SsoLoginServiceAbstraction,
    configService: ConfigService,
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    accountService: AccountService,
    private messageListener: MessageListener,
    @Inject(WINDOW) protected win: Window,
  ) {
    super(
      loginStrategyService,
      router,
      i18nService,
      apiService,
      platformUtilsService,
      win,
      environmentService,
      stateService,
      route,
      logService,
      twoFactorService,
      appIdService,
      loginEmailService,
      userDecryptionOptionsService,
      ssoLoginService,
      configService,
      masterPasswordService,
      accountService,
    );
    super.onSuccessfulLogin = async () => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      syncService.fullSync(true);
    };

    super.onSuccessfulLoginTde = async () => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      syncService.fullSync(true);
    };

    this.messageListener
      .messages$(new CommandDefinition("webauthn.touch-required"))
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        this.webauthnState = TwoFactorWebauthnState.TouchRequired;
      });
    this.messageListener
      .messages$(new CommandDefinition("webauthn.device-required"))
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => {
        this.webauthnState = TwoFactorWebauthnState.DeviceRequired;
      });
  }

  async ngOnInit(): Promise<void> {
    const isNativeWebauthnSupported = await ipc.platform.webauthn.supportsNative();
    if (isNativeWebauthnSupported) {
      this.useIframeWebAuthn = false;
    }
    await super.ngOnInit();
  }

  async anotherMethod() {
    const [modal, childComponent] = await this.modalService.openViewRef(
      TwoFactorOptionsComponent,
      this.twoFactorOptionsModal,
    );

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    modal.onShown.subscribe(() => {
      this.showingModal = true;
    });
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    modal.onClosed.subscribe(() => {
      this.showingModal = false;
    });

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    childComponent.onProviderSelected.subscribe(async (provider: TwoFactorProviderType) => {
      modal.close();
      this.selectedProviderType = provider;
      await this.init();
    });
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    childComponent.onRecoverSelected.subscribe(() => {
      modal.close();
    });
  }

  async submit() {
    if (this.selectedProviderType === TwoFactorProviderType.WebAuthn && !this.useIframeWebAuthn) {
      await this.authWebAuthn();
    } else {
      await this.submit_final();
    }
  }

  async submit_final() {
    await super.submit();
    if (this.captchaSiteKey) {
      const content = document.getElementById("content") as HTMLDivElement;
      content.setAttribute("style", "width:335px");
    }
  }

  protected override setupDuoResultListener() {
    if (!this.duoCallbackSubscriptionEnabled) {
      this.broadcasterService.subscribe(BroadcasterSubscriptionId, async (message: any) => {
        await this.ngZone.run(async () => {
          if (message.command === "duoCallback") {
            this.token = message.code + "|" + message.state;
            await this.submit();
          }
        });
      });
      this.duoCallbackSubscriptionEnabled = true;
    }
  }

  override async launchDuoFrameless() {
    const duoHandOffMessage = {
      title: this.i18nService.t("youSuccessfullyLoggedIn"),
      message: this.i18nService.t("youMayCloseThisWindow"),
      isCountdown: false,
    };

    // we're using the connector here as a way to set a cookie with translations
    // before continuing to the duo frameless url
    const env = await firstValueFrom(this.environmentService.environment$);
    const launchUrl =
      env.getWebVaultUrl() +
      "/duo-redirect-connector.html" +
      "?duoFramelessUrl=" +
      encodeURIComponent(this.duoFramelessUrl) +
      "&handOffMessage=" +
      encodeURIComponent(JSON.stringify(duoHandOffMessage));
    this.platformUtilsService.launchUri(launchUrl);
  }

  override async authWebAuthn() {
    const providerData = await this.twoFactorService.getProviders().then((providers) => {
      return providers.get(this.selectedProviderType);
    });
    const providerDataString = JSON.stringify(providerData);
    const env = await firstValueFrom(this.environmentService.environment$);
    if (this.pin === "") {
      this.pin = undefined;
    }
    this.webauthnState = TwoFactorWebauthnState.Processing;
    const authenticatorResponse = await ipc.platform.webauthn.authenticate(
      providerDataString,
      env.getWebVaultUrl(),
      this.pin,
    );
    // returns "pin-required" instead if the user needs to enter a pin
    if (authenticatorResponse === "pin-required") {
      this.webauthnState = TwoFactorWebauthnState.PinRequired;
      return;
    }
    this.webauthnState = TwoFactorWebauthnState.Processing;
    this.token = authenticatorResponse;
    await this.submit_final();
  }

  ngOnDestroy(): void {
    if (this.duoCallbackSubscriptionEnabled) {
      this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
      this.duoCallbackSubscriptionEnabled = false;
    }
    this.destroyed$.next();
    this.destroyed$.complete();
  }
}

enum TwoFactorWebauthnState {
  DeviceRequired,
  TouchRequired,
  PinRequired,
  Processing,
}
