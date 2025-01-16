// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, NgZone } from "@angular/core";
import { ActivatedRoute } from "@angular/router";

import { GeneratorComponent as BaseGeneratorComponent } from "@bitwarden/angular/tools/generator/components/generator.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";
import {
  PasswordGenerationServiceAbstraction,
  UsernameGenerationServiceAbstraction,
} from "@bitwarden/generator-legacy";

import { PasswordGeneratorHistoryComponent } from "./password-generator-history.component";

@Component({
  selector: "app-generator",
  templateUrl: "generator.component.html",
})
export class GeneratorComponent extends BaseGeneratorComponent {
  constructor(
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    usernameGenerationService: UsernameGenerationServiceAbstraction,
    accountService: AccountService,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    logService: LogService,
    route: ActivatedRoute,
    ngZone: NgZone,
    private dialogService: DialogService,
    toastService: ToastService,
  ) {
    super(
      passwordGenerationService,
      usernameGenerationService,
      platformUtilsService,
      accountService,
      i18nService,
      logService,
      route,
      ngZone,
      window,
      toastService,
    );
    if (platformUtilsService.isSelfHost()) {
      // Allow only valid email forwarders for self host
      this.forwardOptions = this.forwardOptions.filter((forwarder) => forwarder.validForSelfHosted);
    }
  }

  get isSelfHosted(): boolean {
    return this.platformUtilsService.isSelfHost();
  }

  async history() {
    this.dialogService.open(PasswordGeneratorHistoryComponent);
  }

  lengthChanged() {
    document.getElementById("length").focus();
  }

  minNumberChanged() {
    document.getElementById("min-number").focus();
  }

  minSpecialChanged() {
    document.getElementById("min-special").focus();
  }
}
