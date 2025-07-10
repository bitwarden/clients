import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Observable } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  BannerModule,
  IconButtonModule,
  LinkModule,
  TypographyModule,
} from "@bitwarden/components";

import { VaultPopupAutofillService } from "../../../services/vault-popup-autofill.service";

const blockedURISettingsRoute = "/blocked-domains";

@Component({
  imports: [
    BannerModule,
    CommonModule,
    IconButtonModule,
    JslibModule,
    LinkModule,
    RouterModule,
    TypographyModule,
  ],
  selector: "blocked-injection-banner",
  templateUrl: "blocked-injection-banner.component.html",
})
export class BlockedInjectionBanner implements OnInit {
  /**
   * Flag indicating that the banner should be shown
   */
  protected showCurrentTabIsBlockedBanner$: Observable<boolean> =
    this.vaultPopupAutofillService.showCurrentTabIsBlockedBanner$;

  /**
   * Hostname for current tab
   */
  protected currentTabHostname?: string;

  blockedURISettingsRoute: string = blockedURISettingsRoute;

  constructor(private vaultPopupAutofillService: VaultPopupAutofillService) {}

  async ngOnInit() {}

  async handleCurrentTabIsBlockedBannerDismiss() {
    await this.vaultPopupAutofillService.dismissCurrentTabIsBlockedBanner();
  }
}
