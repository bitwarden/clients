import { CurrencyPipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  FormFieldModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { OrganizationBillingClient } from "../clients";

export interface PrivilegedControlsSubscriptionOptions {
  interval: "year" | "month";
  seatCount: number;
  maxAutoscaleSeats: number | undefined;
  seatMinimum: number;
  seatPrice: number;
}

@Component({
  selector: "app-privileged-controls-adjust-subscription",
  templateUrl: "./privileged-controls-adjust-subscription.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FormFieldModule,
    CheckboxModule,
    ButtonModule,
    AsyncActionsModule,
    I18nPipe,
    CurrencyPipe,
  ],
})
export class PrivilegedControlsAdjustSubscriptionComponent {
  private readonly organizationBillingClient = inject(OrganizationBillingClient);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly formBuilder = inject(FormBuilder);

  readonly organizationId = input.required<OrganizationId>();
  readonly options = input.required<PrivilegedControlsSubscriptionOptions>();
  readonly adjusted = output<void>();

  protected readonly formGroup = this.formBuilder.nonNullable.group({
    seatCount: this.formBuilder.control<number | null>(null),
    limitSeats: false,
    maxAutoscaleSeats: this.formBuilder.control<number | null>({ value: null, disabled: true }),
  });

  protected readonly formValue = toSignal(
    this.formGroup.valueChanges.pipe(map(() => this.formGroup.getRawValue())),
    { initialValue: this.formGroup.getRawValue() },
  );

  protected readonly seatFloor = computed(() =>
    Math.min(this.options().seatMinimum, this.options().seatCount),
  );

  protected readonly seatTotalCost = computed(
    () => (this.formValue().seatCount ?? 0) * this.options().seatPrice,
  );

  protected readonly maxSeatTotalCost = computed(
    () => (this.formValue().maxAutoscaleSeats ?? 0) * this.options().seatPrice,
  );

  protected readonly unchanged = computed(() => {
    const options = this.options();
    const value = this.formValue();
    const limitSeats = options.maxAutoscaleSeats != null;
    return (
      value.seatCount === options.seatCount &&
      value.limitSeats === limitSeats &&
      (!limitSeats || value.maxAutoscaleSeats === options.maxAutoscaleSeats)
    );
  });

  constructor() {
    effect(() => {
      const options = this.options();
      const seatFloor = this.seatFloor();
      untracked(() => this.resetForm(options, seatFloor));
    });

    this.formGroup.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.updateSeatLimitControl());
  }

  protected readonly submit = async () => {
    this.formGroup.markAllAsTouched();

    const { seatCount, limitSeats, maxAutoscaleSeats } = this.formGroup.getRawValue();

    if (this.formGroup.invalid || seatCount == null || this.unchanged()) {
      return;
    }

    await this.organizationBillingClient.updatePrivilegedControlsSubscription(
      this.organizationId(),
      {
        seatAdjustment: seatCount - this.options().seatCount,
        maxAutoscaleSeats: limitSeats ? maxAutoscaleSeats : null,
      },
    );

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("subscriptionUpdated"),
    });

    this.adjusted.emit();
  };

  private resetForm(options: PrivilegedControlsSubscriptionOptions, seatFloor: number) {
    this.formGroup.controls.seatCount.setValidators([
      Validators.required,
      Validators.min(seatFloor),
      this.wholeNumberValidator,
    ]);
    this.formGroup.patchValue({
      seatCount: options.seatCount,
      limitSeats: options.maxAutoscaleSeats != null,
      maxAutoscaleSeats: options.maxAutoscaleSeats ?? null,
    });
  }

  private updateSeatLimitControl() {
    const { limitSeats, seatCount } = this.formGroup.getRawValue();
    const control = this.formGroup.controls.maxAutoscaleSeats;

    if (limitSeats) {
      control.setValidators([
        Validators.required,
        Validators.min(seatCount ?? 0),
        this.wholeNumberValidator,
      ]);
      control.enable({ emitEvent: false });
    } else {
      control.disable({ emitEvent: false });
    }

    control.updateValueAndValidity({ emitEvent: false });
  }

  private readonly wholeNumberValidator: ValidatorFn = (
    control: AbstractControl,
  ): ValidationErrors | null => {
    const value = control.value;
    if (value == null || value === "" || Number.isInteger(value)) {
      return null;
    }
    return { wholeNumber: { message: this.i18nService.t("integerInputError") } };
  };
}
