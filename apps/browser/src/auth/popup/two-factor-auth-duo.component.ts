import { DialogModule } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";
import { Subject, Subscription, filter, firstValueFrom, takeUntil } from "rxjs";

import { TwoFactorAuthDuoComponent as TwoFactorAuthDuoBaseComponent } from "@bitwarden/angular/auth/components/two-factor-auth/two-factor-auth-duo.component";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { AsyncActionsModule } from "../../../../../libs/components/src/async-actions";
import { ButtonModule } from "../../../../../libs/components/src/button";
import { FormFieldModule } from "../../../../../libs/components/src/form-field";
import { LinkModule } from "../../../../../libs/components/src/link";
import { I18nPipe } from "../../../../../libs/components/src/shared/i18n.pipe";
import { TypographyModule } from "../../../../../libs/components/src/typography";
import { ZonedMessageListenerService } from "../../platform/browser/zoned-message-listener.service";

@Component({
  standalone: true,
  selector: "app-two-factor-auth-duo",
  templateUrl:
    "../../../../../libs/angular/src/auth/components/two-factor-auth/two-factor-auth-duo.component.html",
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
  private destroy$ = new Subject<void>();
  duoResultSubscription: Subscription;

  constructor(
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    private browserMessagingApi: ZonedMessageListenerService,
    private environmentService: EnvironmentService,
  ) {
    super(i18nService, platformUtilsService);
  }

  async ngOnInit(): Promise<void> {
    await super.ngOnInit();
  }

  async ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected override setupDuoResultListener() {
    if (!this.duoResultSubscription) {
      this.duoResultSubscription = this.browserMessagingApi
        .messageListener$()
        .pipe(
          filter((msg: any) => msg.command === "duoResult"),
          takeUntil(this.destroy$),
        )
        .subscribe((msg: { command: string; code: string; state: string }) => {
          this.token.emit(msg.code + "|" + msg.state);
        });
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
}
