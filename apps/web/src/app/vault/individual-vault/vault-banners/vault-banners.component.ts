// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, map, Observable, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { BannerModule } from "@bitwarden/components";

import { VerifyEmailComponent } from "../../../auth/settings/verify-email.component";
import { FreeTrial } from "../../../billing/types/free-trial";
import { SharedModule } from "../../../shared";

import { VaultBannersService, VisibleVaultBanner } from "./services/vault-banners.service";

@Component({
  standalone: true,
  selector: "app-vault-banners",
  templateUrl: "./vault-banners.component.html",
  imports: [VerifyEmailComponent, SharedModule, BannerModule],
  providers: [VaultBannersService],
})
export class VaultBannersComponent implements OnInit {
  visibleBanners: VisibleVaultBanner[] = [];
  premiumBannerVisible$: Observable<boolean>;
  VisibleVaultBanner = VisibleVaultBanner;
  @Input() organizationsPaymentStatus: FreeTrial[] = [];

  private activeUserId$ = this.accountService.activeAccount$.pipe(map((a) => a?.id));

  constructor(
    private vaultBannerService: VaultBannersService,
    private router: Router,
    private i18nService: I18nService,
    private accountService: AccountService,
  ) {
    this.premiumBannerVisible$ = this.activeUserId$.pipe(
      switchMap((userId) => this.vaultBannerService.shouldShowPremiumBanner$(userId)),
    );
  }

  async ngOnInit(): Promise<void> {
    await this.determineVisibleBanners();
  }

  async dismissBanner(banner: VisibleVaultBanner): Promise<void> {
    const activeUserId = await firstValueFrom(this.activeUserId$);
    await this.vaultBannerService.dismissBanner(activeUserId, banner);

    await this.determineVisibleBanners();
  }

  async navigateToPaymentMethod(organizationId: string): Promise<void> {
    const navigationExtras = {
      state: { launchPaymentModalAutomatically: true },
    };

    await this.router.navigate(
      ["organizations", organizationId, "billing", "payment-method"],
      navigationExtras,
    );
  }

  /** Determine which banners should be present */
  private async determineVisibleBanners(): Promise<void> {
    const activeUserId = await firstValueFrom(this.activeUserId$);

    const showBrowserOutdated =
      await this.vaultBannerService.shouldShowUpdateBrowserBanner(activeUserId);
    const showVerifyEmail = await this.vaultBannerService.shouldShowVerifyEmailBanner(activeUserId);
    const showLowKdf = await this.vaultBannerService.shouldShowLowKDFBanner(activeUserId);

    this.visibleBanners = [
      showBrowserOutdated ? VisibleVaultBanner.OutdatedBrowser : null,
      showVerifyEmail ? VisibleVaultBanner.VerifyEmail : null,
      showLowKdf ? VisibleVaultBanner.KDFSettings : null,
    ].filter(Boolean); // remove all falsy values, i.e. null
  }

  freeTrialMessage(organization: FreeTrial) {
    if (organization.remainingDays >= 2) {
      return this.i18nService.t(
        "freeTrialEndPromptMultipleDays",
        organization.organizationName,
        organization.remainingDays.toString(),
      );
    } else if (organization.remainingDays === 1) {
      return this.i18nService.t("freeTrialEndPromptTomorrow", organization.organizationName);
    } else {
      return this.i18nService.t("freeTrialEndPromptToday", organization.organizationName);
    }
  }

  trackBy(index: number) {
    return index;
  }
}
