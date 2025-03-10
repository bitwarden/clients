// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { Subject, firstValueFrom, takeUntil } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import {
  getOrganizationById,
  InternalOrganizationServiceAbstraction,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationData } from "@bitwarden/common/admin-console/models/data/organization.data";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationSubscriptionUpdateRequest } from "@bitwarden/common/billing/models/request/organization-subscription-update.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

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

  constructor(
    private i18nService: I18nService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private formBuilder: FormBuilder,
    private toastService: ToastService,
    private internalOrganizationService: InternalOrganizationServiceAbstraction,
    private accountService: AccountService,
  ) {}

  ngOnInit() {
    this.adjustSubscriptionForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value) => {
      const maxAutoscaleSeatsControl = this.adjustSubscriptionForm.controls.newMaxSeats;

      if (value.limitSubscription) {
        maxAutoscaleSeatsControl.setValidators([Validators.min(value.newSeatCount)]);
        maxAutoscaleSeatsControl.enable({ emitEvent: false });
      } else {
        maxAutoscaleSeatsControl.disable({ emitEvent: false });
      }
    });

    this.adjustSubscriptionForm.patchValue({
      newSeatCount: this.currentSeatCount,
      newMaxSeats: this.maxAutoscaleSeats,
      limitSubscription: this.maxAutoscaleSeats != null,
    });
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

    const response = await this.organizationApiService.updatePasswordManagerSeats(
      this.organizationId,
      request,
    );

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const organization = await firstValueFrom(
      this.internalOrganizationService
        .organizations$(userId)
        .pipe(getOrganizationById(this.organizationId)),
    );

    const organizationData = new OrganizationData(response, {
      isMember: organization.isMember,
      isProviderUser: organization.isProviderUser,
    });

    await this.internalOrganizationService.upsert(organizationData, userId);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("subscriptionUpdated"),
    });

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

  get maxSeatTotal(): number {
    return Math.abs((this.adjustSubscriptionForm.value.newMaxSeats ?? 0) * this.seatPrice);
  }

  get seatTotalCost(): number {
    return Math.abs(this.adjustSubscriptionForm.value.newSeatCount * this.seatPrice);
  }

  get limitSubscription(): boolean {
    return this.adjustSubscriptionForm.value.limitSubscription;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
