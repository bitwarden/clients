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
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from "@angular/forms";

import { PrivilegedControlsAlt } from "@bitwarden/assets/svg";
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
  readonly passwordManagerSeats = input.required<number>();
  readonly passwordManagerMaxAutoscaleSeats = input<number | null>(null);

  readonly purchased = output<void>();

  protected readonly logo = PrivilegedControlsAlt;

  protected readonly seatLimitCap = computed(
    () => this.passwordManagerMaxAutoscaleSeats() ?? this.passwordManagerSeats(),
  );

  protected readonly seatPrice = computed(() =>
    this.discountPrice(this.plan().PrivilegedControls.seatPrice),
  );

  protected readonly monthlyCostPerSeat = computed(() =>
    this.plan().isAnnual ? this.seatPrice() / 12 : this.seatPrice(),
  );

  protected readonly interval = computed(() => (this.plan().isAnnual ? "year" : "month"));

  protected readonly formGroup = new FormGroup({
    enabled: new FormControl(false, { nonNullable: true }),
    seats: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(MAX_PURCHASABLE_QUANTITY),
      (control: AbstractControl) => this.validateSeats(control),
    ]),
    maxAutoscaleSeats: new FormControl<number | null>(null, [
      Validators.max(MAX_PURCHASABLE_QUANTITY),
      (control: AbstractControl) => this.validateSeatLimit(control),
    ]),
  });

  protected readonly seats = toSignal(this.formGroup.controls.seats.valueChanges, {
    initialValue: this.formGroup.controls.seats.value,
  });

  protected readonly maxAutoscaleSeats = toSignal(
    this.formGroup.controls.maxAutoscaleSeats.valueChanges,
    { initialValue: this.formGroup.controls.maxAutoscaleSeats.value },
  );

  protected readonly maxSeatTotal = computed(
    () => (this.maxAutoscaleSeats() ?? 0) * this.seatPrice(),
  );

  ngOnInit() {
    const { enabled, seats, maxAutoscaleSeats } = this.formGroup.controls;

    seats.setValue(1);

    this.toggleFields(enabled.value);
    enabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.toggleFields(value));

    seats.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => maxAutoscaleSeats.updateValueAndValidity());
  }

  protected readonly submit = async () => {
    this.formGroup.markAllAsTouched();
    const { seats, maxAutoscaleSeats } = this.formGroup.getRawValue();
    if (this.formGroup.invalid || seats == null) {
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

  private validateSeats(control: AbstractControl): ValidationErrors | null {
    if (control.value == null) {
      return null;
    }
    if (!Number.isInteger(control.value)) {
      return { wholeNumber: { message: this.i18nService.t("integerInputError") } };
    }
    const passwordManagerSeats = this.passwordManagerSeats();
    return control.value > passwordManagerSeats
      ? {
          seatsAbovePasswordManagerSeats: {
            message: this.i18nService.t(
              "privilegedControlsSeatsAbovePasswordManagerSeats",
              passwordManagerSeats,
            ),
          },
        }
      : null;
  }

  private validateSeatLimit(control: AbstractControl): ValidationErrors | null {
    if (control.value == null) {
      return null;
    }
    const seats = control.parent?.get("seats")?.value ?? 0;
    if (!Number.isInteger(control.value) || control.value <= seats) {
      return {
        seatLimitNotAboveSeats: {
          message: this.i18nService.t("privilegedControlsSeatLimitNotAboveSeats"),
        },
      };
    }
    const cap = this.seatLimitCap();
    if (control.value <= cap) {
      return null;
    }
    const messageKey =
      this.passwordManagerMaxAutoscaleSeats() == null
        ? "privilegedControlsSeatLimitAbovePasswordManagerSeats"
        : "privilegedControlsSeatLimitAbovePasswordManagerSeatLimit";
    return {
      seatLimitAbovePasswordManager: { message: this.i18nService.t(messageKey, cap) },
    };
  }
}
