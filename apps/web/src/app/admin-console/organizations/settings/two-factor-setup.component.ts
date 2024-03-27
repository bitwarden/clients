import { Component } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { concatMap, takeUntil, map } from "rxjs";
import { tap } from "rxjs/operators";

import { ModalService } from "@bitwarden/angular/services/modal.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { TwoFactorDuoComponent } from "../../../auth/settings/two-factor-duo.component";
import { TwoFactorSetupComponent as BaseTwoFactorSetupComponent } from "../../../auth/settings/two-factor-setup.component";

@Component({
  selector: "app-two-factor-setup",
  templateUrl: "../../../auth/settings/two-factor-setup.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class TwoFactorSetupComponent extends BaseTwoFactorSetupComponent {
  tabbedHeader = false;
  constructor(
    apiService: ApiService,
    modalService: ModalService,
    messagingService: MessagingService,
    policyService: PolicyService,
    private route: ActivatedRoute,
    private organizationService: OrganizationService,
    billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {
    super(
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
    switch (type) {
      case TwoFactorProviderType.OrganizationDuo: {
        const duoComp = await this.openModal(this.duoModalRef, TwoFactorDuoComponent);
        duoComp.type = TwoFactorProviderType.OrganizationDuo;
        duoComp.organizationId = this.organizationId;
        duoComp.onUpdated.pipe(takeUntil(this.destroy$)).subscribe((enabled: boolean) => {
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
