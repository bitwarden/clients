import { CurrencyPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, OnInit, inject, input, output } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { firstValueFrom } from "rxjs";

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
import {
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  FormFieldModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "app-adjust-subscription",
  templateUrl: "adjust-subscription.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AsyncActionsModule,
    ButtonModule,
    CheckboxModule,
    FormFieldModule,
    I18nPipe,
    CurrencyPipe,
  ],
})
export class AdjustSubscriptionComponent implements OnInit {
  private readonly i18nService = inject(I18nService);
  private readonly organizationApiService = inject(OrganizationApiServiceAbstraction);
  private readonly formBuilder = inject(FormBuilder);
  private readonly toastService = inject(ToastService);
  private readonly internalOrganizationService = inject(InternalOrganizationServiceAbstraction);
  private readonly accountService = inject(AccountService);

  readonly organizationId = input<string | undefined>(undefined);
  readonly maxAutoscaleSeats = input<number>();
  readonly currentSeatCount = input<number | undefined>(undefined);
  readonly seatPrice = input(0);
  readonly interval = input("year");
  readonly onAdjusted = output();

  readonly adjustSubscriptionForm = this.formBuilder.group({
    newSeatCount: [0, [Validators.min(0)]],
    limitSubscription: [false],
    newMaxSeats: [0, [Validators.min(0)]],
  });

  constructor() {
    this.adjustSubscriptionForm.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const maxAutoscaleSeatsControl = this.adjustSubscriptionForm.controls.newMaxSeats;

      if (value.limitSubscription) {
        maxAutoscaleSeatsControl.setValidators([Validators.min(value.newSeatCount ?? 0)]);
        maxAutoscaleSeatsControl.enable({ emitEvent: false });
      } else {
        maxAutoscaleSeatsControl.disable({ emitEvent: false });
      }
    });
  }

  ngOnInit() {
    this.adjustSubscriptionForm.patchValue({
      newSeatCount: this.currentSeatCount(),
      newMaxSeats: this.maxAutoscaleSeats(),
      limitSubscription: this.maxAutoscaleSeats() != null,
    });
  }

  readonly submit = async () => {
    this.adjustSubscriptionForm.markAllAsTouched();
    const organizationId = this.organizationId();
    if (this.adjustSubscriptionForm.invalid || organizationId == null) {
      return;
    }
    const request = new OrganizationSubscriptionUpdateRequest(
      this.additionalSeatCount,
      this.adjustSubscriptionForm.value.newMaxSeats ?? undefined,
    );

    const response = await this.organizationApiService.updatePasswordManagerSeats(
      organizationId,
      request,
    );

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const organization = await firstValueFrom(
      this.internalOrganizationService
        .organizations$(userId)
        .pipe(getOrganizationById(organizationId)),
    );

    const organizationData = new OrganizationData(response, {
      isMember: organization?.isMember ?? false,
      isProviderUser: organization?.isProviderUser ?? false,
    });

    await this.internalOrganizationService.upsert(organizationData, userId);

    this.toastService.showToast({
      variant: "success",
      title: undefined,
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
    return (this.adjustSubscriptionForm.value.newSeatCount ?? 0) - (this.currentSeatCount() ?? 0);
  }

  get maxSeatTotal(): number {
    return Math.abs((this.adjustSubscriptionForm.value.newMaxSeats ?? 0) * this.seatPrice());
  }

  get seatTotalCost(): number {
    return Math.abs((this.adjustSubscriptionForm.value.newSeatCount ?? 0) * this.seatPrice());
  }

  get limitSubscription(): boolean {
    return this.adjustSubscriptionForm.value.limitSubscription ?? false;
  }
}
