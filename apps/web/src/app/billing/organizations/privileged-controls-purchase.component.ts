import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
  selector: "billing-privileged-controls-purchase",
  templateUrl: "privileged-controls-purchase.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SharedModule],
})
export class PrivilegedControlsPurchaseComponent implements OnInit {
  private readonly organizationBillingClient = inject(OrganizationBillingClient);
  private readonly syncService = inject(SyncService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  readonly plan = input.required<PlanResponse>();
  readonly organizationId = input.required<OrganizationId>();
  readonly customerDiscount = input<BillingCustomerDiscount | null>(null);
  readonly passwordManagerSeats = input.required<number>();
  readonly passwordManagerMaxAutoscaleSeats = input<number | null>(null);

  readonly purchased = output<void>();

  protected readonly logo = PrivilegedControlsAlt;

  protected readonly enabledControl = new FormControl(false, { nonNullable: true });

  protected readonly enabled = toSignal(this.enabledControl.valueChanges, {
    initialValue: this.enabledControl.value,
  });

  protected readonly maxAutoscaleSeatsCap = computed(
    () => this.passwordManagerMaxAutoscaleSeats() ?? this.passwordManagerSeats(),
  );

  protected readonly seatPrice = computed(() =>
    this.discountPrice(this.plan().PrivilegedControls.seatPrice),
  );

  protected readonly monthlyCostPerSeat = computed(() =>
    this.plan().isAnnual ? this.seatPrice() / 12 : this.seatPrice(),
  );

  protected readonly interval = computed(() => (this.plan().isAnnual ? "year" : "month"));

  private readonly seatsControl = new FormControl<number | null>(null, [
    Validators.required,
    Validators.min(1),
    Validators.max(MAX_PURCHASABLE_QUANTITY),
    (control: AbstractControl) => this.validateWholeNumber(control),
    (control: AbstractControl) => this.validateSeatsWithinPasswordManagerSeats(control),
  ]);

  private readonly maxAutoscaleSeatsControl = new FormControl<number | null>(null, [
    Validators.max(MAX_PURCHASABLE_QUANTITY),
    (control: AbstractControl) => this.validateWholeNumber(control),
    (control: AbstractControl) => this.validateMaxAutoscaleSeatsAboveSeats(control),
    (control: AbstractControl) => this.validateMaxAutoscaleSeatsWithinCap(control),
  ]);

  protected readonly formGroup = new FormGroup({
    seats: this.seatsControl,
    maxAutoscaleSeats: this.maxAutoscaleSeatsControl,
  });

  protected readonly seats = toSignal(this.seatsControl.valueChanges, {
    initialValue: this.seatsControl.value,
  });

  protected readonly maxAutoscaleSeats = toSignal(this.maxAutoscaleSeatsControl.valueChanges, {
    initialValue: this.maxAutoscaleSeatsControl.value,
  });

  protected readonly maxSeatTotal = computed(
    () => (this.maxAutoscaleSeats() ?? 0) * this.seatPrice(),
  );

  constructor() {
    this.seatsControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.maxAutoscaleSeatsControl.updateValueAndValidity());
  }

  ngOnInit() {
    // Set after inputs are bound, since the seats validators read the required passwordManagerSeats input.
    this.seatsControl.setValue(1);
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

  private validateWholeNumber(control: AbstractControl): ValidationErrors | null {
    if (control.value == null || Number.isInteger(control.value)) {
      return null;
    }
    return { wholeNumber: { message: this.i18nService.t("integerInputError") } };
  }

  private validateSeatsWithinPasswordManagerSeats(
    control: AbstractControl,
  ): ValidationErrors | null {
    if (control.value == null) {
      return null;
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

  private validateMaxAutoscaleSeatsAboveSeats(control: AbstractControl): ValidationErrors | null {
    if (control.value == null || control.value > (this.seatsControl.value ?? 0)) {
      return null;
    }
    return {
      maxAutoscaleSeatsNotAboveSeats: {
        message: this.i18nService.t("privilegedControlsSeatLimitNotAboveSeats"),
      },
    };
  }

  private validateMaxAutoscaleSeatsWithinCap(control: AbstractControl): ValidationErrors | null {
    if (control.value == null) {
      return null;
    }
    const cap = this.maxAutoscaleSeatsCap();
    if (control.value <= cap) {
      return null;
    }
    const messageKey =
      this.passwordManagerMaxAutoscaleSeats() == null
        ? "privilegedControlsSeatLimitAbovePasswordManagerSeats"
        : "privilegedControlsSeatLimitAbovePasswordManagerSeatLimit";
    return {
      maxAutoscaleSeatsAbovePasswordManager: { message: this.i18nService.t(messageKey, cap) },
    };
  }
}
