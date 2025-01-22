import { LiveAnnouncer } from "@angular/cdk/a11y";
import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ClientType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { ButtonModule, LinkModule, TypographyModule } from "@bitwarden/components";

import { NewDeviceVerificationNoticeService } from "../../services/new-device-verification-notice.service";

@Component({
  standalone: true,
  selector: "app-new-device-verification-notice-page-two",
  templateUrl: "./new-device-verification-notice-page-two.component.html",
  imports: [CommonModule, JslibModule, TypographyModule, ButtonModule, LinkModule],
})
export class NewDeviceVerificationNoticePageTwoComponent implements OnInit, AfterViewInit {
  protected isWeb: boolean;
  protected isDesktop: boolean;
  protected permanentFlagEnabled = false;
  readonly currentAcct$: Observable<Account | null> = this.accountService.activeAccount$;
  private currentUserId: UserId | null = null;
  private env$: Observable<Environment> = this.environmentService.environment$;

  constructor(
    private newDeviceVerificationNoticeService: NewDeviceVerificationNoticeService,
    private router: Router,
    private accountService: AccountService,
    private platformUtilsService: PlatformUtilsService,
    private environmentService: EnvironmentService,
    private configService: ConfigService,
    private liveAnnouncer: LiveAnnouncer,
    private i18nService: I18nService,
  ) {
    this.isWeb = this.platformUtilsService.getClientType() === ClientType.Web;
    this.isDesktop = this.platformUtilsService.getClientType() === ClientType.Desktop;
  }

  async ngOnInit() {
    this.permanentFlagEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.NewDeviceVerificationPermanentDismiss,
    );

    const currentAcct = await firstValueFrom(this.currentAcct$);
    if (!currentAcct) {
      return;
    }
    this.currentUserId = currentAcct.id;
  }

  ngAfterViewInit() {
    void this.liveAnnouncer.announce(this.i18nService.t("setupTwoStepLogin"), "polite");
  }

  async navigateToTwoStepLogin(event: Event) {
    event.preventDefault();

    const env = await firstValueFrom(this.env$);
    const url = env.getWebVaultUrl();

    if (this.isWeb) {
      await this.router.navigate(["/settings/security/two-factor"], {
        queryParams: { fromNewDeviceVerification: true },
      });
    } else {
      this.platformUtilsService.launchUri(
        url + "/#/settings/security/two-factor/?fromNewDeviceVerification=true",
      );
    }
  }

  async navigateToChangeAcctEmail(event: Event) {
    event.preventDefault();

    const env = await firstValueFrom(this.env$);
    const url = env.getWebVaultUrl();
    if (this.isWeb) {
      await this.router.navigate(["/settings/account"], {
        queryParams: { fromNewDeviceVerification: true },
      });
    } else {
      this.platformUtilsService.launchUri(
        url + "/#/settings/account/?fromNewDeviceVerification=true",
      );
    }
  }

  async remindMeLaterSelect() {
    await this.newDeviceVerificationNoticeService.updateNewDeviceVerificationNoticeState(
      this.currentUserId!,
      {
        last_dismissal: new Date(),
        permanent_dismissal: false,
      },
    );

    await this.router.navigate(["/vault"]);
  }
}
