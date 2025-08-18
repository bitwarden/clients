import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";
import { Observable, firstValueFrom, of, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { DialogService, ItemModule } from "@bitwarden/components";

import { FamiliesPolicyService } from "../../../billing/services/families-policy.service";
import { BrowserApi } from "../../../platform/browser/browser-api";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "more-from-bitwarden-page-v2.component.html",
  imports: [
    CommonModule,
    JslibModule,
    RouterModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    ItemModule,
  ],
})
export class MoreFromBitwardenPageV2Component {
  canAccessPremium$: Observable<boolean>;
  protected familySponsorshipAvailable$: Observable<boolean>;
  protected isFreeFamilyPolicyEnabled$: Observable<boolean>;
  protected hasSingleEnterpriseOrg$: Observable<boolean>;

  constructor(
    private dialogService: DialogService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private environmentService: EnvironmentService,
    private organizationService: OrganizationService,
    private familiesPolicyService: FamiliesPolicyService,
    private accountService: AccountService,
  ) {
    this.familySponsorshipAvailable$ = getUserId(this.accountService.activeAccount$).pipe(
      switchMap((userId) => this.organizationService.familySponsorshipAvailable$(userId)),
    );
    this.canAccessPremium$ = this.accountService.activeAccount$.pipe(
      switchMap((account) =>
        account
          ? this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id)
          : of(false),
      ),
    );
    this.hasSingleEnterpriseOrg$ = this.familiesPolicyService.hasSingleEnterpriseOrg$();
    this.isFreeFamilyPolicyEnabled$ = this.familiesPolicyService.isFreeFamilyPolicyEnabled$();
  }

  async openFreeBitwardenFamiliesPage() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToWebApp" },
      content: { key: "freeBitwardenFamiliesPageDesc" },
      type: "info",
      acceptButtonText: { key: "continue" },
    });
    if (confirmed) {
      const env = await firstValueFrom(this.environmentService.environment$);
      const url = env.getWebVaultUrl();
      await BrowserApi.createNewTab(url + "/#/settings/sponsored-families");
    }
  }

  async openBitwardenForBusinessPage() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToBitwardenDotCom" },
      content: { key: "bitwardenForBusinessPageDesc" },
      type: "info",
      acceptButtonText: { key: "continue" },
    });
    if (confirmed) {
      await BrowserApi.createNewTab("https://bitwarden.com/products/business/");
    }
  }

  async openAuthenticatorPage() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToBitwardenDotCom" },
      content: { key: "continueToAuthenticatorPageDesc" },
      type: "info",
      acceptButtonText: { key: "continue" },
    });
    if (confirmed) {
      await BrowserApi.createNewTab("https://bitwarden.com/products/authenticator");
    }
  }

  async openSecretsManagerPage() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToBitwardenDotCom" },
      content: { key: "continueToSecretsManagerPageDesc" },
      type: "info",
      acceptButtonText: { key: "continue" },
    });
    if (confirmed) {
      await BrowserApi.createNewTab("https://bitwarden.com/products/secrets-manager");
    }
  }

  async openPasswordlessDotDevPage() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "continueToBitwardenDotCom" },
      content: { key: "continueToPasswordlessDotDevPageDesc" },
      type: "info",
      acceptButtonText: { key: "continue" },
    });
    if (confirmed) {
      await BrowserApi.createNewTab("https://bitwarden.com/products/passwordless");
    }
  }
}
