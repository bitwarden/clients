// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { concatMap, takeUntil, map, lastValueFrom, firstValueFrom } from "rxjs";
import { first, tap } from "rxjs/operators";

import {
  getOrganizationById,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TwoFactorDuoResponse } from "@bitwarden/common/auth/models/response/two-factor-duo.response";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { AuthResponse } from "@bitwarden/common/auth/types/auth-response";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { DialogRef, DialogService } from "@bitwarden/components";

import { TwoFactorSetupDuoComponent } from "../../../auth/settings/two-factor/two-factor-setup-duo.component";
import { TwoFactorSetupComponent as BaseTwoFactorSetupComponent } from "../../../auth/settings/two-factor/two-factor-setup.component";
import { TwoFactorVerifyComponent } from "../../../auth/settings/two-factor/two-factor-verify.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-two-factor-setup",
  templateUrl: "../../../auth/settings/two-factor/two-factor-setup.component.html",
  standalone: false,
})
export class TwoFactorSetupComponent extends BaseTwoFactorSetupComponent implements OnInit {
  tabbedHeader = false;
  constructor(
    dialogService: DialogService,
    twoFactorService: TwoFactorService,
    messagingService: MessagingService,
    policyService: PolicyService,
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
    protected accountService: AccountService,
    configService: ConfigService,
    i18nService: I18nService,
  ) {
    super(
      dialogService,
      twoFactorService,
      messagingService,
      policyService,
      billingAccountProfileStateService,
      accountService,
      configService,
      i18nService,
    );
  }

  async ngOnInit() {
    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    this.route.params
      .pipe(
        concatMap((params) =>
          this.organizationService
            .organizations$(userId)
            .pipe(getOrganizationById(params.organizationId))
            .pipe(map((organization) => ({ params, organization }))),
        ),
        tap(async (mapResponse) => {
          this.organizationId = mapResponse.params.organizationId;
          this.organization = mapResponse.organization;
        }),
        concatMap(async () => await super.ngOnInit()),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  async manage(type: TwoFactorProviderType) {
    // clear any existing subscriptions before creating a new one
    this.twoFactorSetupSubscription?.unsubscribe();

    switch (type) {
      case TwoFactorProviderType.OrganizationDuo: {
        const twoFactorVerifyDialogRef = TwoFactorVerifyComponent.open(this.dialogService, {
          data: { type: type, organizationId: this.organizationId },
        });
        const result: AuthResponse<TwoFactorDuoResponse> = await lastValueFrom(
          twoFactorVerifyDialogRef.closed,
        );
        if (!result) {
          return;
        }
        const duoComp: DialogRef<boolean, any> = TwoFactorSetupDuoComponent.open(
          this.dialogService,
          {
            data: {
              authResponse: result,
              organizationId: this.organizationId,
            },
          },
        );
        this.twoFactorSetupSubscription = duoComp.componentInstance.onChangeStatus
          .pipe(first(), takeUntil(this.destroy$))
          .subscribe((enabled: boolean) => {
            duoComp.close();
            this.updateStatus(enabled, TwoFactorProviderType.OrganizationDuo);
          });

        break;
      }
      default:
        break;
    }
  }

  protected getTwoFactorProviders() {
    return this.twoFactorService.getTwoFactorOrganizationProviders(this.organizationId);
  }

  protected filterProvider(type: TwoFactorProviderType): boolean {
    return type !== TwoFactorProviderType.OrganizationDuo;
  }
}
