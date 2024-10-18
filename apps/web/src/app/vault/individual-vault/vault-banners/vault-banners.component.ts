import { Component, OnInit } from "@angular/core";
import { firstValueFrom, map, Observable } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BannerModule } from "@bitwarden/components";

import { VerifyEmailComponent } from "../../../auth/settings/verify-email.component";
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

  private activeUserId$ = this.accountService.activeAccount$.pipe(map((a) => a.id));

  constructor(
    private vaultBannerService: VaultBannersService,
    private accountService: AccountService,
  ) {
    this.premiumBannerVisible$ = this.vaultBannerService.shouldShowPremiumBanner$(
      this.activeUserId$,
    );
  }

  async ngOnInit(): Promise<void> {
    await this.determineVisibleBanners();
  }

  async dismissBanner(banner: VisibleVaultBanner): Promise<void> {
    await this.vaultBannerService.dismissBanner(await firstValueFrom(this.activeUserId$), banner);

    await this.determineVisibleBanners();
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
}
