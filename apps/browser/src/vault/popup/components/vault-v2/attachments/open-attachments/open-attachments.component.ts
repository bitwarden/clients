// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { firstValueFrom, map, switchMap } from "rxjs";

import { PremiumBadgeComponent } from "@bitwarden/angular/billing/components/premium-badge";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { BadgeModule, ItemModule, ToastService, TypographyModule } from "@bitwarden/components";
import { CipherFormContainer } from "@bitwarden/vault";

import BrowserPopupUtils from "../../../../../../platform/browser/browser-popup-utils";
import { FilePopoutUtilsService } from "../../../../../../tools/popup/services/file-popout-utils.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-open-attachments",
  templateUrl: "./open-attachments.component.html",
  imports: [
    BadgeModule,
    CommonModule,
    ItemModule,
    JslibModule,
    TypographyModule,
    PremiumBadgeComponent,
  ],
})
export class OpenAttachmentsComponent implements OnInit {
  /** Cipher `id` */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true }) cipherId: CipherId;

  /** True when the attachments window should be opened in a popout */
  openAttachmentsInPopout: boolean;

  /** True when the user has access to premium or h  */
  canAccessAttachments: boolean;

  /** True when the cipher is a part of a free organization */
  cipherIsAPartOfFreeOrg: boolean;

  /** Tracks the disabled status of the edit cipher form */
  parentFormDisabled: boolean;

  constructor(
    private router: Router,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private cipherService: CipherService,
    private organizationService: OrganizationService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private filePopoutUtilsService: FilePopoutUtilsService,
    private accountService: AccountService,
    private cipherFormContainer: CipherFormContainer,
    private premiumUpgradeService: PremiumUpgradePromptService,
  ) {
    this.accountService.activeAccount$
      .pipe(
        switchMap((account) =>
          this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((canAccessPremium) => {
        this.canAccessAttachments = canAccessPremium;
      });

    this.cipherFormContainer.formStatusChange$.pipe(takeUntilDestroyed()).subscribe((status) => {
      this.parentFormDisabled = status === "disabled";
    });
  }

  async ngOnInit(): Promise<void> {
    this.openAttachmentsInPopout = this.filePopoutUtilsService.showFilePopoutMessage(window);

    if (!this.cipherId) {
      return;
    }

    const activeUserId = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.id)),
    );
    const cipherDomain = await this.cipherService.get(this.cipherId, activeUserId);
    const cipher = await this.cipherService.decrypt(cipherDomain, activeUserId);

    if (!cipher.organizationId) {
      this.cipherIsAPartOfFreeOrg = false;
      return;
    }

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const org = await firstValueFrom(
      this.organizationService
        .organizations$(userId)
        .pipe(getOrganizationById(cipher.organizationId)),
    );

    this.cipherIsAPartOfFreeOrg = org.productTierType === ProductTierType.Free;
  }

  /** Routes the user to the attachments screen, if available */
  async openAttachments() {
    if (!this.canAccessAttachments) {
      await this.premiumUpgradeService.promptForPremium();
      return;
    }

    if (this.cipherIsAPartOfFreeOrg) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("freeOrgsCannotUseAttachments"),
      });
      return;
    }

    await this.router.navigate(["/attachments"], { queryParams: { cipherId: this.cipherId } });

    // Open the attachments page in a popout
    // This is done after the router navigation to ensure that the navigation
    // is included in the `PopupRouterCacheService` history
    if (this.openAttachmentsInPopout) {
      await BrowserPopupUtils.openCurrentPagePopout(window);
    }
  }
}
