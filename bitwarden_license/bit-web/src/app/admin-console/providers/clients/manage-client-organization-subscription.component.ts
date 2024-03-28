import { DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject, OnInit } from "@angular/core";

import { BillingApiServiceAbstraction as BillingApiService } from "@bitwarden/common/billing/abstractions/billilng-api.service.abstraction";
import { ProviderSubscriptionUpdateRequest } from "@bitwarden/common/billing/models/request/provider-subscription-update.request";
import { ProviderPlansResponse } from "@bitwarden/common/billing/models/response/provider-plans.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

type ManageClientOrganizationDialogParams = {
  organizationId: string;
  providerId: string;
  clientName: string;
  assignedSeats: number;
  unassignedSeats: number;
};

@Component({
  templateUrl: "manage-client-organization-subscription.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class ManageClientOrganizationSubscriptionComponent implements OnInit {
  loading = true;
  organizationId: string;
  providerId: string;
  clientName: string;
  assignedSeats: number;
  unassignedSeats: number;
  AdditionalSeatPurchased: number;
  remainingOpenSeats: number;

  constructor(
    public dialogRef: DialogRef,
    @Inject(DIALOG_DATA) protected data: ManageClientOrganizationDialogParams,
    private billingApiService: BillingApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
  ) {
    this.organizationId = data.organizationId;
    this.providerId = data.providerId;
    this.clientName = data.clientName;
    this.assignedSeats = data.assignedSeats;
    this.unassignedSeats = data.unassignedSeats;
  }

  async ngOnInit() {
    try {
      const response = await this.billingApiService.getProviderClientSubscriptions(this.providerId);
      this.AdditionalSeatPurchased = this.getProviderAssignedSeats(response.providerPlans);
      const seatMinimum = this.getProviderSeatMinimum(response.providerPlans);
      this.remainingOpenSeats = this.assignedSeats - seatMinimum;
    } catch (error) {
      this.AdditionalSeatPurchased = 0;
      this.remainingOpenSeats = 0;
    }
    this.loading = false;
  }

  async updateSubscription(assignedSeats: number) {
    if (!assignedSeats) {
      this.platformUtilsService.showToast(
        "error",
        null,
        this.i18nService.t("assignedSeatCannotUpdate"),
      );
      return;
    }

    const request = new ProviderSubscriptionUpdateRequest();
    request.assignedSeats = assignedSeats;

    //await this.billingApiService.putProviderClientSubscriptions(this.providerId,this.organizationId,request);
    this.platformUtilsService.showToast("success", null, this.i18nService.t("subscriptionUpdated"));

    this.dialogRef.close();
  }

  getProviderAssignedSeats(plans: ProviderPlansResponse[]) {
    return plans.reduce(
      (total: number, plan: ProviderPlansResponse) => total + plan.purchasedSeats,
      0,
    );
  }

  getProviderSeatMinimum(plans: ProviderPlansResponse[]) {
    return plans.reduce(
      (total: number, plan: ProviderPlansResponse) => total + plan.seatMinimum,
      0,
    );
  }

  static open(dialogService: DialogService, data: ManageClientOrganizationDialogParams) {
    return dialogService.open(ManageClientOrganizationSubscriptionComponent, { data });
  }
}
