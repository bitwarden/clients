import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from "@angular/forms";

import { BillingCustomerDiscount } from "@bitwarden/common/billing/models/response/organization-subscription.response";
import { PlanResponse } from "@bitwarden/common/billing/models/response/plan.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ToastService } from "@bitwarden/components";

import { SharedModule } from "../../shared";
import { OrganizationBillingClient } from "../clients/organization-billing.client";

const MAX_PURCHASABLE_QUANTITY = 100000;

@Component({
  selector: "app-privileged-controls-purchase",
  templateUrl: "privileged-controls-purchase.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SharedModule],
})
export class PrivilegedControlsPurchaseComponent implements OnInit {
  private readonly organizationBillingClient = inject(OrganizationBillingClient);
  private readonly syncService = inject(SyncService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly plan = input.required<PlanResponse>();
  readonly organizationId = input.required<OrganizationId>();
  readonly customerDiscount = input<BillingCustomerDiscount | null>(null);

  readonly purchased = output<void>();

  protected readonly maxQuantity = MAX_PURCHASABLE_QUANTITY;

  protected readonly seatMinimum = computed(
    () => this.plan().PrivilegedControls.defaultSeatMinimum,
  );

  protected readonly monthlyCostPerSeat = computed(() => {
    const plan = this.plan();
    const seatPrice = this.discountPrice(plan.PrivilegedControls.seatPrice);
    return plan.isAnnual ? seatPrice / 12 : seatPrice;
  });

  protected readonly formGroup = new FormGroup({
    enabled: new FormControl(false, { nonNullable: true }),
    seats: new FormControl<number | null>(null, [
      Validators.required,
      (control: AbstractControl) => this.validateSeatMinimum(control),
      Validators.max(MAX_PURCHASABLE_QUANTITY),
    ]),
    maxAutoscaleSeats: new FormControl<number | null>(null, [
      Validators.max(MAX_PURCHASABLE_QUANTITY),
      (control: AbstractControl) => this.validateSeatLimit(control),
    ]),
  });

  ngOnInit() {
    const { enabled, seats, maxAutoscaleSeats } = this.formGroup.controls;

    seats.setValue(this.seatMinimum());

    this.toggleFields(enabled.value);
    enabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.toggleFields(value));

    seats.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => maxAutoscaleSeats.updateValueAndValidity({ emitEvent: false }));
  }

  protected readonly submit = async () => {
    const { seats, maxAutoscaleSeats } = this.formGroup.getRawValue();
    if (seats == null) {
      return;
    }

    await this.organizationBillingClient.purchasePrivilegedControls(this.organizationId(), {
      seats,
      maxAutoscaleSeats: maxAutoscaleSeats ?? null,
    });

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("privilegedControlsPurchased"),
    });

    await this.syncService.fullSync(true);

    this.purchased.emit();
  };

  private discountPrice(price: number): number {
    const discount = this.customerDiscount();
    return discount?.active ? price - price * ((discount.percentOff ?? 0) / 100) : price;
  }

  private toggleFields(enabled: boolean) {
    const { seats, maxAutoscaleSeats } = this.formGroup.controls;
    if (enabled) {
      seats.enable();
      maxAutoscaleSeats.enable();
    } else {
      seats.disable();
      maxAutoscaleSeats.disable();
    }
  }

  private validateSeatMinimum(control: AbstractControl): ValidationErrors | null {
    if (control.value == null) {
      return null;
    }
    const minimum = this.seatMinimum();
    return control.value < minimum ? { min: { min: minimum, actual: control.value } } : null;
  }

  private validateSeatLimit(control: AbstractControl): ValidationErrors | null {
    const seats = control.parent?.get("seats")?.value;
    return control.value != null && seats != null && control.value < seats
      ? {
          seatLimitBelowSeats: {
            message: this.i18nService.t("privilegedControlsSeatLimitBelowSeats"),
          },
        }
      : null;
  }
}
