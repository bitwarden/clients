import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  CardComponent,
  CenterPositionStrategy,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  ItemModule,
  ToastService,
} from "@bitwarden/components";
import { TroubleshootingDialogComponent } from "@bitwarden/logging-angular";
import { I18nPipe } from "@bitwarden/ui-common";

import { BrowserApi } from "../../../../platform/browser/browser-api";
import { PopOutComponent } from "../../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../platform/popup/layout/popup-page.component";
import { AboutDialogComponent } from "../about-dialog/about-dialog.component";

const RateUrls = {
  [DeviceType.ChromeExtension]:
    "https://chromewebstore.google.com/detail/bitwarden-free-password-m/nngceckbapebfimnlniiiahkandclblb/reviews",
  [DeviceType.FirefoxExtension]:
    "https://addons.mozilla.org/en-US/firefox/addon/bitwarden-password-manager/#reviews",
  [DeviceType.OperaExtension]:
    "https://addons.opera.com/en/extensions/details/bitwarden-free-password-manager/#feedback-container",
  [DeviceType.EdgeExtension]:
    "https://microsoftedge.microsoft.com/addons/detail/jbkfoedolllekgbhcbcoahefnbanhhlh",
  [DeviceType.VivaldiExtension]:
    "https://chromewebstore.google.com/detail/bitwarden-free-password-m/nngceckbapebfimnlniiiahkandclblb/reviews",
  [DeviceType.SafariExtension]: "https://apps.apple.com/app/bitwarden/id1352778147",
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "about-page-v2.component.html",
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    ItemModule,
    CardComponent,
    CheckboxModule,
    FormFieldModule,
    I18nPipe,
  ],
})
export class AboutPageV2Component implements OnInit {
  private accountService = inject(AccountService);
  private configService = inject(ConfigService);
  private toastService = inject(ToastService);
  private i18nService = inject(I18nService);
  private formBuilder = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  protected earlyAccessForm = this.formBuilder.group({ earlyAccess: false });

  protected readonly showEarlyAccessToggle = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.EarlyAccess),
    { initialValue: false },
  );

  constructor(
    private dialogService: DialogService,
    private environmentService: EnvironmentService,
    private platformUtilsService: PlatformUtilsService,
  ) {}

  async ngOnInit(): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const current = await firstValueFrom(this.configService.earlyAccess$(userId));
    this.earlyAccessForm.controls.earlyAccess.setValue(current, { emitEvent: false });

    this.earlyAccessForm.controls.earlyAccess.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => {
        void this.onEarlyAccessChange(enabled ?? false);
      });
  }

  private async onEarlyAccessChange(enabled: boolean): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    if (enabled) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "enableEarlyAccessConfirmTitle" },
        content: { key: "enableEarlyAccessConfirmContent" },
        type: "warning",
      });

      if (!confirmed) {
        this.earlyAccessForm.controls.earlyAccess.setValue(false, { emitEvent: false });
        return;
      }

      await this.configService.setEarlyAccess(userId, true);
      this.toastService.showToast({
        variant: "info",
        message: this.i18nService.t("earlyAccessEnabledToast"),
      });
      return;
    }

    await this.configService.setEarlyAccess(userId, false);
  }

  about() {
    this.dialogService.open(AboutDialogComponent, {
      positionStrategy: new CenterPositionStrategy(),
    });
  }

  troubleshoot() {
    TroubleshootingDialogComponent.open(this.dialogService);
  }

  async launchHelp() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToHelpCenter" },
      content: { key: "continueToHelpCenterDesc" },
      type: "info",
      acceptButtonText: { key: "continue" },
    });
    if (confirmed) {
      await BrowserApi.createNewTab("https://bitwarden.com/help/");
    }
  }

  async openWebVault() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToWebApp" },
      content: { key: "continueToWebAppDesc" },
      type: "info",
      acceptButtonText: { key: "continue" },
    });
    if (confirmed) {
      const env = await firstValueFrom(this.environmentService.environment$);
      const url = env.getWebVaultUrl();
      await BrowserApi.createNewTab(url);
    }
  }

  async rate() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToBrowserExtensionStore" },
      content: { key: "continueToBrowserExtensionStoreDesc" },
      type: "info",
      acceptButtonText: { key: "continue" },
    });
    if (confirmed) {
      const deviceType = this.platformUtilsService.getDevice();
      await BrowserApi.createNewTab((RateUrls as any)[deviceType]);
    }
  }
}
