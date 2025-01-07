import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { RouterModule } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import {
  BannerModule,
  IconButtonModule,
  LinkModule,
  TypographyModule,
} from "@bitwarden/components";

import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";
import { VaultListItemsContainerComponent } from "../vault-list-items-container/vault-list-items-container.component";

const blockedURISettingsRoute = "/blocked-domains";

@Component({
  standalone: true,
  imports: [
    BannerModule,
    CommonModule,
    IconButtonModule,
    JslibModule,
    LinkModule,
    RouterModule,
    TypographyModule,
    VaultListItemsContainerComponent,
  ],
  selector: "blocked-injection-banner",
  templateUrl: "blocked-injection-banner.component.html",
})
export class BlockedInjectionBanner implements OnInit {
  /**
   * Flag indicating that the banner should be shown
   */
  protected showScriptInjectionIsBlockedBanner = false;

  /**
   * Hostname for current tab
   */
  protected currentTabHostname?: string;

  blockedURISettingsRoute: string = blockedURISettingsRoute;

  constructor(
    private domainSettingsService: DomainSettingsService,
    private vaultPopupAutofillService: VaultPopupAutofillService,
  ) {}

  async ngOnInit() {
    this.showScriptInjectionIsBlockedBanner = await firstValueFrom(
      this.vaultPopupAutofillService.currentTabBlockedBannerIsDismissed$,
    );

    const currentTab = await firstValueFrom(this.vaultPopupAutofillService.currentAutofillTab$);

    const autofillTabURL = currentTab?.url && new URL(currentTab.url);

    this.currentTabHostname = autofillTabURL && autofillTabURL.hostname;
  }

  handleScriptInjectionIsBlockedBannerDismiss() {
    if (!this.currentTabHostname) {
      return;
    }

    try {
      void firstValueFrom(this.domainSettingsService.blockedInteractionsUris$).then(
        (blockedURIs) => {
          this.showScriptInjectionIsBlockedBanner = false;
          void this.domainSettingsService.setBlockedInteractionsUris({
            ...blockedURIs,
            [this.currentTabHostname as string]: { bannerIsDismissed: true },
          });
        },
      );
    } catch (e) {
      throw new Error(
        "There was a problem dismissing the blocked interaction URI notification banner",
      );
    }
  }
}
