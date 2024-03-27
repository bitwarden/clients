import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationSubscriptionUpdateRequest } from "@bitwarden/common/billing/models/request/organization-subscription-update.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

@Component({
  selector: "app-adjust-subscription",
  templateUrl: "adjust-subscription.component.html",
})
export class AdjustSubscription {
  @Input() organizationId: string;
  @Input() maxAutoscaleSeats: number;
  @Input() currentSeatCount: number;
  @Input() seatPrice = 0;
  @Input() interval = "year";
  @Output() onAdjusted = new EventEmitter();
  adjustSubscriptionForm = this.formBuilder.group({
    newSeatCount: [0, [Validators.min(0)]],
    limitSubscription: [false],
    newMaxSeats: [0, [Validators.min(0)]],
  });

  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private formBuilder: FormBuilder,
  ) {}

  ngOnInit() {
    this.adjustSubscriptionForm.patchValue({
      newSeatCount: this.currentSeatCount,
      limitSubscription: this.maxAutoscaleSeats != null,
      newMaxSeats: this.maxAutoscaleSeats,
    });
  }

  submit = async () => {
    try {
      const request = new OrganizationSubscriptionUpdateRequest(
        this.additionalSeatCount,
        this.adjustSubscriptionForm.value.newMaxSeats,
      );
      await this.organizationApiService.updatePasswordManagerSeats(this.organizationId, request);

      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("subscriptionUpdated"),
      );
    } catch (e) {
      this.logService.error(e);
    }
    this.onAdjusted.emit();
  };

  limitSubscriptionChanged() {
    if (!this.adjustSubscriptionForm.value.limitSubscription) {
      this.adjustSubscriptionForm.value.newMaxSeats = null;
    }
  }

  get additionalSeatCount(): number {
    return this.adjustSubscriptionForm.value.newSeatCount
      ? this.adjustSubscriptionForm.value.newSeatCount - this.currentSeatCount
      : 0;
  }

  get additionalMaxSeatCount(): number {
    return this.adjustSubscriptionForm.value.newMaxSeats
      ? this.adjustSubscriptionForm.value.newMaxSeats - this.currentSeatCount
      : 0;
  }

  get adjustedSeatTotal(): number {
    return this.additionalSeatCount * this.seatPrice;
  }

  get maxSeatTotal(): number {
    return this.additionalMaxSeatCount * this.seatPrice;
  }
}
