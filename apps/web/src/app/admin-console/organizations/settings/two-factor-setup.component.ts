// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogRef } from "@angular/cdk/dialog";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { concatMap, takeUntil, map, lastValueFrom } from "rxjs";
import { first, tap } from "rxjs/operators";

import { ModalService } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TwoFactorDuoResponse } from "@bitwarden/common/auth/models/response/two-factor-duo.response";
import { AuthResponse } from "@bitwarden/common/auth/types/auth-response";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { DialogService } from "@bitwarden/components";

import { TwoFactorSetupDuoComponent } from "../../../auth/settings/two-factor/two-factor-setup-duo.component";
import { TwoFactorSetupComponent as BaseTwoFactorSetupComponent } from "../../../auth/settings/two-factor/two-factor-setup.component";
import { TwoFactorVerifyComponent } from "../../../auth/settings/two-factor/two-factor-verify.component";

@Component({
  selector: "app-two-factor-setup",
  templateUrl: "../../../auth/settings/two-factor/two-factor-setup.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class TwoFactorSetupComponent extends BaseTwoFactorSetupComponent implements OnInit {
  tabbedHeader = false;
  constructor(
    dialogService: DialogService,
    apiService: ApiService,
    modalService: ModalService,
    messagingService: MessagingService,
    policyService: PolicyService,
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {
    super(
      dialogService,
      apiService,
      modalService,
      messagingService,
      policyService,
      billingAccountProfileStateService,
    );
  }

  async ngOnInit() {
    this.route.params
      .pipe(
        concatMap((params) =>
          this.organizationService
            .get$(params.organizationId)
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
    return this.apiService.getTwoFactorOrganizationProviders(this.organizationId);
  }

  protected filterProvider(type: TwoFactorProviderType) {
    return type !== TwoFactorProviderType.OrganizationDuo;
  }
}
