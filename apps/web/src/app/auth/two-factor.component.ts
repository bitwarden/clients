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
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";

import { RouterService } from "../core";

import { TwoFactorOptionsComponent } from "./two-factor-options.component";

@Component({
  selector: "app-two-factor",
  templateUrl: "two-factor.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class TwoFactorComponent extends BaseTwoFactorComponent {
  @ViewChild("twoFactorOptions", { read: ViewContainerRef, static: true })
  twoFactorOptionsModal: ViewContainerRef;

  constructor(
    authService: AuthService,
    router: Router,
    i18nService: I18nService,
    apiService: ApiService,
    platformUtilsService: PlatformUtilsService,
    stateService: StateService,
    environmentService: EnvironmentService,
    private modalService: ModalService,
    route: ActivatedRoute,
    logService: LogService,
    twoFactorService: TwoFactorService,
    appIdService: AppIdService,
    private routerService: RouterService,
    loginService: LoginService,
    configService: ConfigServiceAbstraction,
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
    this.onSuccessfulLoginNavigate = this.goAfterLogIn;
  }

  async anotherMethod() {
    const [modal] = await this.modalService.openViewRef(
      TwoFactorOptionsComponent,
      this.twoFactorOptionsModal,
      (comp) => {
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onProviderSelected.subscribe(async (provider: TwoFactorProviderType) => {
          modal.close();
          this.selectedProviderType = provider;
          await this.init();
        });
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil
        comp.onRecoverSelected.subscribe(() => {
          modal.close();
        });
      }
    );
  }

  protected override handleMigrateEncryptionKey(result: AuthResult): boolean {
    if (!result.requiresEncryptionKeyMigration) {
      return false;
    }
    this.router.navigate(["migrate-legacy-encryption"]);
    return true;
  }

  goAfterLogIn = async () => {
    this.loginService.clearValues();
    const previousUrl = this.routerService.getPreviousUrl();
    if (previousUrl) {
      this.router.navigateByUrl(previousUrl);
    } else {
      // if we have an emergency access invite, redirect to emergency access
      const emergencyAccessInvite = await this.stateService.getEmergencyAccessInvitation();
      if (emergencyAccessInvite != null) {
        this.router.navigate(["/accept-emergency"], {
          queryParams: {
            id: emergencyAccessInvite.id,
            name: emergencyAccessInvite.name,
            email: emergencyAccessInvite.email,
            token: emergencyAccessInvite.token,
          },
        });
        return;
      }

      this.router.navigate([this.successRoute], {
        queryParams: {
          identifier: this.orgIdentifier,
        },
      });
    }
  };
}
