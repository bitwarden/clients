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
import { OrganizationSmSubscriptionUpdateRequest } from "@bitwarden/common/billing/models/request/organization-sm-subscription-update.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

export interface SecretsManagerSubscriptionOptions {
  interval: "year" | "month";

  /**
   * The current number of seats the organization subscribes to.
   */
  seatCount: number;

  /**
   * Optional auto-scaling limit for the number of seats the organization can subscribe to.
   */
  maxAutoscaleSeats: number;

  /**
   * The price per seat for the subscription.
   */
  seatPrice: number;

  /**
   * The number of service accounts that are included in the base subscription.
   */
  baseServiceAccountCount: number;

  /**
   * The current number of additional service accounts the organization subscribes to.
   */
  additionalServiceAccounts: number;

  /**
   * Optional auto-scaling limit for the number of additional service accounts the organization can subscribe to.
   */
  maxAutoscaleServiceAccounts: number;

  /**
   * The price per additional service account for the subscription.
   */
  additionalServiceAccountPrice: number;
}

@Component({
  selector: "app-sm-adjust-subscription",
  templateUrl: "sm-adjust-subscription.component.html",
})
export class SecretsManagerAdjustSubscriptionComponent implements OnInit, OnDestroy {
  @Input() organizationId: string;
  @Input() options: SecretsManagerSubscriptionOptions;
  @Output() onAdjusted = new EventEmitter();

  private destroy$ = new Subject<void>();

  formGroup = this.formBuilder.group({
    seatCount: [0, [Validators.required, Validators.min(1)]],
    limitSeats: [false],
    maxAutoscaleSeats: [null as number | null],
    additionalServiceAccounts: [0, [Validators.required, Validators.min(0)]],
    limitServiceAccounts: [false],
    maxAutoscaleServiceAccounts: [null as number | null],
  });

  get monthlyServiceAccountPrice(): number {
    return this.options.interval == "month"
      ? this.options.additionalServiceAccountPrice
      : this.options.additionalServiceAccountPrice / 12;
  }

  get serviceAccountTotalCost(): number {
    return Math.abs(
      this.formGroup.value.additionalServiceAccounts * this.options.additionalServiceAccountPrice,
    );
  }

  get seatTotalCost(): number {
    return Math.abs(this.formGroup.value.seatCount * this.options.seatPrice);
  }

  get maxAdditionalServiceAccounts(): number {
    const maxTotalServiceAccounts = this.formGroup.value.maxAutoscaleServiceAccounts ?? 0;
    return Math.max(0, maxTotalServiceAccounts - this.options.baseServiceAccountCount);
  }

  get maxServiceAccountTotalCost(): number {
    return this.maxAdditionalServiceAccounts * this.options.additionalServiceAccountPrice;
  }

  get maxSeatTotalCost(): number {
    return Math.abs((this.formGroup.value.maxAutoscaleSeats ?? 0) * this.options.seatPrice);
  }

  constructor(
    private formBuilder: FormBuilder,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private toastService: ToastService,
    private internalOrganizationService: InternalOrganizationServiceAbstraction,
    private accountService: AccountService,
  ) {}

  ngOnInit() {
    this.formGroup.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value) => {
      const maxAutoscaleSeatsControl = this.formGroup.controls.maxAutoscaleSeats;
      const maxAutoscaleServiceAccountsControl =
        this.formGroup.controls.maxAutoscaleServiceAccounts;

      if (value.limitSeats) {
        maxAutoscaleSeatsControl.setValidators([Validators.min(value.seatCount)]);
        maxAutoscaleSeatsControl.enable({ emitEvent: false });
      } else {
        maxAutoscaleSeatsControl.disable({ emitEvent: false });
      }

      if (value.limitServiceAccounts) {
        maxAutoscaleServiceAccountsControl.setValidators([
          Validators.min(value.additionalServiceAccounts + this.options.baseServiceAccountCount),
        ]);
        maxAutoscaleServiceAccountsControl.enable({ emitEvent: false });
      } else {
        maxAutoscaleServiceAccountsControl.disable({ emitEvent: false });
      }
    });

    this.formGroup.patchValue({
      seatCount: this.options.seatCount,
      maxAutoscaleSeats: this.options.maxAutoscaleSeats,
      additionalServiceAccounts: this.options.additionalServiceAccounts,
      maxAutoscaleServiceAccounts: this.options.maxAutoscaleServiceAccounts,
      limitSeats: this.options.maxAutoscaleSeats != null,
      limitServiceAccounts: this.options.maxAutoscaleServiceAccounts != null,
    });
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    const request = new OrganizationSmSubscriptionUpdateRequest();
    request.seatAdjustment = this.formGroup.value.seatCount - this.options.seatCount;
    request.serviceAccountAdjustment =
      this.formGroup.value.additionalServiceAccounts - this.options.additionalServiceAccounts;
    request.maxAutoscaleSeats = this.formGroup.value.limitSeats
      ? this.formGroup.value.maxAutoscaleSeats
      : null;
    request.maxAutoscaleServiceAccounts = this.formGroup.value.limitServiceAccounts
      ? this.formGroup.value.maxAutoscaleServiceAccounts
      : null;

    const response = await this.organizationApiService.updateSecretsManagerSubscription(
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

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
