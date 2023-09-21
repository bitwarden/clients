import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { UpdatePasswordComponent as BaseUpdatePasswordComponent } from "@bitwarden/angular/auth/components/update-password.component";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { DialogService } from "@bitwarden/components";

@Component({
  selector: "app-update-password",
  templateUrl: "update-password.component.html",
})
export class UpdatePasswordComponent extends BaseUpdatePasswordComponent {
  constructor(
    router: Router,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    policyService: PolicyService,
    cryptoService: CryptoService,
    messagingService: MessagingService,
    apiService: ApiService,
    logService: LogService,
    stateService: StateService,
    userVerificationService: UserVerificationService,
    dialogService: DialogService
  ) {
    super(
      router,
      i18nService,
      platformUtilsService,
      passwordGenerationService,
      policyService,
      cryptoService,
      messagingService,
      apiService,
      stateService,
      userVerificationService,
      logService,
      dialogService
    );
  }
}
