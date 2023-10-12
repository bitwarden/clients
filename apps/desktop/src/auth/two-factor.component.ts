import { Component, Inject, ViewChild, ViewContainerRef } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { TwoFactorComponent as BaseTwoFactorComponent } from "@bitwarden/angular/auth/components/two-factor.component";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { LoginService } from "@bitwarden/common/auth/abstractions/login.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { DeviceType } from "@bitwarden/common/enums";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
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

  showingModal = false;
  needsWebauthnConnectorFallback = false;

  constructor(
    authService: AuthService,
    router: Router,
    i18nService: I18nService,
    apiService: ApiService,
    platformUtilsService: PlatformUtilsService,
    syncService: SyncService,
    environmentService: EnvironmentService,
    private modalService: ModalService,
    stateService: StateService,
    route: ActivatedRoute,
    logService: LogService,
    twoFactorService: TwoFactorService,
    appIdService: AppIdService,
    loginService: LoginService,
    configService: ConfigServiceAbstraction,
    private broadcasterService: BroadcasterService,
    @Inject(WINDOW) protected win: Window
  ) {
    super(
      authService,
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
      loginService,
      configService
    );
    this.needsWebauthnConnectorFallback =
      this.platformUtilsService.getDevice() !== DeviceType.WindowsDesktop;
    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      switch (message.command) {
        case "webauthnCallback":
          this.token = message.data;
          this.submitWebauthn();
          break;
      }
    });

    super.onSuccessfulLogin = async () => {
      syncService.fullSync(true);
    };

    super.onSuccessfulLoginTde = async () => {
      syncService.fullSync(true);
    };
  }

  async anotherMethod() {
    const [modal, childComponent] = await this.modalService.openViewRef(
      TwoFactorOptionsComponent,
      this.twoFactorOptionsModal
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
      if (
        !(
          this.selectedProviderType == TwoFactorProviderType.WebAuthn &&
          this.needsWebauthnConnectorFallback
        )
      ) {
        await this.init();
      }
    });
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    childComponent.onRecoverSelected.subscribe(() => {
      modal.close();
    });
  }

  async submit() {
    await super.submit();
    if (this.captchaSiteKey) {
      const content = document.getElementById("content") as HTMLDivElement;
      content.setAttribute("style", "width:335px");
    }
  }

  // remove once webauthn is natively available in electron on all platforms (https://github.com/electron/electron/issues/24573)
  async launchWebauthnBrowser() {
    const webUrl = this.environmentService.getWebVaultUrl();
    const data = {
      callbackUri: "bitwarden://webauthn-callback",
      data: JSON.stringify(
        this.twoFactorService.getProviders().get(TwoFactorProviderType.WebAuthn)
      ),
      headerText: "FIDO2 WebAuthn",
      btnText: "Authenticate with WebAuthn",
      btnReturnText: "Return to Bitwarden",
    };
    const b64data = this.base64Encode(JSON.stringify(data));

    this.platformUtilsService.launchUri(
      webUrl +
        "/webauthn-mobile-connector.html" +
        "?data=" +
        b64data +
        "&parent=" +
        encodeURIComponent("bitwarden://webauthn-callback") +
        "&v=2"
    );
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
  }

  async submitWebauthn() {
    await this.setupCaptcha();

    if (this.token == null || this.token === "") {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("verificationCodeRequired")
      );
      return;
    }

    await super.doSubmit();
  }

  base64Encode(str: string): string {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(("0x" + p1) as any);
      })
    );
  }
}
