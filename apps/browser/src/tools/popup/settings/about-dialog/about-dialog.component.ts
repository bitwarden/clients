import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { Observable, combineLatest, defer, firstValueFrom, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { LabsSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/labs-settings.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ButtonModule, DialogModule, ToastService } from "@bitwarden/components";

@Component({
  templateUrl: "about-dialog.component.html",
  standalone: true,
  imports: [CommonModule, JslibModule, DialogModule, ButtonModule],
})
export class AboutDialogComponent {
  protected year = new Date().getFullYear();
  protected version$: Observable<string>;
  protected clickCount = 0;

  protected data$ = combineLatest([
    this.configService.serverConfig$,
    this.environmentService.environment$.pipe(map((env) => env.isCloud())),
  ]).pipe(map(([serverConfig, isCloud]) => ({ serverConfig, isCloud })));

  constructor(
    private configService: ConfigService,
    private environmentService: EnvironmentService,
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
    private labsSettingsService: LabsSettingsServiceAbstraction,
    private i18nService: I18nService,
  ) {
    this.version$ = defer(() => this.platformUtilsService.getApplicationVersion());
  }

  protected async handleClick() {
    const labSettingsAllowed = await this.configService.getFeatureFlag(
      FeatureFlag.AllowLabsSettings,
    );

    const labSettingsAreEnabled = await firstValueFrom(
      this.labsSettingsService.labsSettingsEnabled$,
    );

    if (!labSettingsAllowed || labSettingsAreEnabled) {
      return;
    }

    this.clickCount++;

    if (this.clickCount > 41) {
      await this.labsSettingsService.setLabsSettingsEnabled(true);

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("labsSettingsEnabled"),
      });
    }
  }
}
