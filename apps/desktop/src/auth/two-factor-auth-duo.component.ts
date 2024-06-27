import { DialogModule } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component, NgZone } from "@angular/core";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
  LinkModule,
  TypographyModule,
} from "@bitwarden/components";

import { TwoFactorAuthDuoComponent as TwoFactorAuthDuoBaseComponent } from "../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-duo.component";

const BroadcasterSubscriptionId = "TwoFactorComponent";

@Component({
  standalone: true,
  selector: "app-two-factor-auth-duo",
  templateUrl:
    "../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-duo.component.html",
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    ButtonModule,
    LinkModule,
    TypographyModule,
    ReactiveFormsModule,
    FormFieldModule,
    AsyncActionsModule,
    FormsModule,
  ],
  providers: [I18nPipe],
})
export class TwoFactorAuthDuoComponent extends TwoFactorAuthDuoBaseComponent {
  constructor(
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    private broadcasterService: BroadcasterService,
    private ngZone: NgZone,
    private environmentService: EnvironmentService,
  ) {
    super(i18nService, platformUtilsService);
  }

  async ngOnInit(): Promise<void> {
    await super.ngOnInit();
  }

  duoCallbackSubscriptionEnabled: boolean = false;

  protected override setupDuoResultListener() {
    if (!this.duoCallbackSubscriptionEnabled) {
      this.broadcasterService.subscribe(BroadcasterSubscriptionId, async (message: any) => {
        await this.ngZone.run(async () => {
          if (message.command === "duoCallback") {
            this.token.emit(message.code + "|" + message.state);
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

  async ngOnDestroy() {
    if (this.duoCallbackSubscriptionEnabled) {
      this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
      this.duoCallbackSubscriptionEnabled = false;
    }
  }
}
