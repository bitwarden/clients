import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationSubscriptionUpdateRequest } from "@bitwarden/common/billing/models/request/organization-subscription-update.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

@Component({
  selector: "app-adjust-subscription",
  templateUrl: "adjust-subscription.component.html",
})
export class AdjustSubscription implements OnInit, OnDestroy {
  @Input() organizationId: string;
  @Input() maxAutoscaleSeats: number;
  @Input() currentSeatCount: number;
  @Input() seatPrice = 0;
  @Input() interval = "year";
  @Output() onAdjusted = new EventEmitter();
  private destroy$ = new Subject<void>();

  adjustSubscriptionForm = this.formBuilder.group({
    newSeatCount: [0, [Validators.min(0)]],
    limitSubscription: [false],
    newMaxSeats: [0, [Validators.min(0)]],
  });
  get limitSubscription(): boolean {
    return this.adjustSubscriptionForm.value.limitSubscription;
  }
  constructor(
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private formBuilder: FormBuilder,
  ) {}

  ngOnInit() {
    this.adjustSubscriptionForm.patchValue({
      newSeatCount: this.currentSeatCount,
      limitSubscription: this.maxAutoscaleSeats != null,
      newMaxSeats: this.maxAutoscaleSeats,
    });
    this.adjustSubscriptionForm
      .get("limitSubscription")
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((value: boolean) => {
        if (value) {
          this.adjustSubscriptionForm
            .get("newMaxSeats")
            .addValidators([
              Validators.min(
                this.adjustSubscriptionForm.value.newSeatCount == null
                  ? 1
                  : this.adjustSubscriptionForm.value.newSeatCount,
              ),
              Validators.required,
            ]);
        }
        this.adjustSubscriptionForm.get("newMaxSeats").updateValueAndValidity();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
  submit = async () => {
    this.adjustSubscriptionForm.markAllAsTouched();
    if (this.adjustSubscriptionForm.invalid) {
      return;
    }
    const request = new OrganizationSubscriptionUpdateRequest(
      this.additionalSeatCount,
      this.adjustSubscriptionForm.value.newMaxSeats,
    );
    await this.organizationApiService.updatePasswordManagerSeats(this.organizationId, request);

    this.platformUtilsService.showToast("success", null, this.i18nService.t("subscriptionUpdated"));

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

  get maxSeatTotal(): number {
    return Math.abs((this.adjustSubscriptionForm.value.newMaxSeats ?? 0) * this.seatPrice);
  }

  get seatTotalCost(): number {
    const totalSeat = Math.abs(this.adjustSubscriptionForm.value.newSeatCount * this.seatPrice);
    return totalSeat;
  }
}
