import { CommonModule } from "@angular/common";
import { Component, ElementRef, ViewChild } from "@angular/core";
import { Observable, combineLatest, defer, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import {
  DialogRef,
  ButtonModule,
  DialogModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "about-dialog.component.html",
  imports: [CommonModule, JslibModule, DialogModule, ButtonModule, TypographyModule],
})
export class AboutDialogComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("version") protected version!: ElementRef;

  protected year = new Date().getFullYear();
  protected version$: Observable<string>;

  protected data$ = combineLatest([
    this.configService.serverConfig$,
    this.environmentService.environment$.pipe(map((env) => env.isCloud())),
  ]).pipe(map(([serverConfig, isCloud]) => ({ serverConfig, isCloud })));

  protected sdkVersion$ = this.sdkService.version$;

  constructor(
    private dialogRef: DialogRef,
    private configService: ConfigService,
    private environmentService: EnvironmentService,
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private sdkService: SdkService,
  ) {
    this.version$ = defer(() => this.platformUtilsService.getApplicationVersion());
  }

  protected copyVersion() {
    this.platformUtilsService.copyToClipboard(this.version.nativeElement.innerText);
    this.toastService.showToast({
      message: this.i18nService.t("copySuccessful"),
      variant: "success",
    });
    this.dialogRef.close();
  }
}
