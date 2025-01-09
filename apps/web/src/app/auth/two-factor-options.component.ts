import { DialogRef } from "@angular/cdk/dialog";
import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { TwoFactorOptionsComponent as BaseTwoFactorOptionsComponent } from "@bitwarden/angular/auth/components/two-factor-options.component";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

export enum TwoFactorOptionsDialogResult {
  Provider = "Provider selected",
  Recover = "Recover selected",
}

export type TwoFactorOptionsDialogResultType = {
  result: TwoFactorOptionsDialogResult;
  type: TwoFactorProviderType;
};

@Component({
  selector: "app-two-factor-options",
  templateUrl: "two-factor-options.component.html",
})
export class TwoFactorOptionsComponent extends BaseTwoFactorOptionsComponent {
  constructor(
    twoFactorService: TwoFactorService,
    router: Router,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    environmentService: EnvironmentService,
    private dialogRef: DialogRef,
  ) {
    super(twoFactorService, router, i18nService, platformUtilsService, window, environmentService);
  }

  async choose(p: any) {
    await super.choose(p);
    this.dialogRef.close({ result: TwoFactorOptionsDialogResult.Provider, type: p.type });
  }

  async recover() {
    await super.recover();
    this.dialogRef.close({ result: TwoFactorOptionsDialogResult.Recover });
  }

  static open(dialogService: DialogService) {
    return dialogService.open<TwoFactorOptionsDialogResultType>(TwoFactorOptionsComponent);
  }
}
