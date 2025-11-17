import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  AbstractControlOptions,
  ControlValueAccessor,
  FormBuilder,
  FormControl,
  FormGroup,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  ValidationErrors,
  Validator,
  Validators,
} from "@angular/forms";
import { filter, map, Observable, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { getFirstPolicy } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  MaximumSessionTimeoutPolicyData,
  SessionTimeoutTypeService,
} from "@bitwarden/common/key-management/session-timeout";
import {
  VaultTimeout,
  VaultTimeoutOption,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import {
  isVaultTimeoutTypeNumeric,
  VaultTimeoutNumberType,
} from "@bitwarden/common/key-management/vault-timeout/types/vault-timeout.type";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FormFieldModule, SelectModule } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";

type SessionTimeoutForm = FormGroup<{
  vaultTimeout: FormControl<VaultTimeout | null>;
  custom: FormGroup<{
    hours: FormControl<number | null>;
    minutes: FormControl<number | null>;
  }>;
}>;

type SessionTimeoutFormValue = SessionTimeoutForm["value"];

@Component({
  selector: "bit-session-timeout-input",
  templateUrl: "session-timeout-input.component.html",
  imports: [CommonModule, JslibModule, ReactiveFormsModule, FormFieldModule, SelectModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: SessionTimeoutInputComponent,
    },
    {
      provide: NG_VALIDATORS,
      multi: true,
      useExisting: SessionTimeoutInputComponent,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SessionTimeoutInputComponent implements ControlValueAccessor, Validator, OnInit {
  static readonly MIN_CUSTOM_MINUTES = 0;

  private readonly formBuilder = inject(FormBuilder);
  private readonly policyService = inject(PolicyService);
  private readonly i18nService = inject(I18nService);
  private readonly accountService = inject(AccountService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sessionTimeoutTypeService = inject(SessionTimeoutTypeService);
  private readonly logService = inject(LogService);

  readonly availableTimeoutOptions = input.required<VaultTimeoutOption[]>();

  protected maxSessionTimeoutPolicyData: MaximumSessionTimeoutPolicyData | null = null;
  protected policyTimeoutMessage$!: Observable<string | null>;

  readonly form: SessionTimeoutForm = this.formBuilder.group(
    {
      vaultTimeout: [null as VaultTimeout | null],
      custom: this.formBuilder.group({
        hours: [0, [Validators.required, Validators.min(0)]],
        minutes: [0, [Validators.required, Validators.min(0), Validators.max(59)]],
      }),
    },
    { validators: [this.formValidator.bind(this)] } as AbstractControlOptions,
  );

  private onChange: ((vaultTimeout: VaultTimeout) => void) | null = null;
  private validatorChange: (() => void) | null = null;

  get isCustomTimeoutType(): boolean {
    return this.form.controls.vaultTimeout.value === VaultTimeoutStringType.Custom;
  }

  get customMinutesMin(): number {
    return this.form.controls.custom.controls.hours.value === 0 ? 1 : 0;
  }

  get exceedsPolicyMaximumTimeout(): boolean {
    return (
      this.maxSessionTimeoutPolicyData?.type === VaultTimeoutStringType.Custom &&
      this.isCustomTimeoutType &&
      this.getTotalMinutesFromCustomValue(this.form.value.custom) >
        this.maxSessionTimeoutPolicyMinutes + 60 * this.maxSessionTimeoutPolicyHours
    );
  }

  ngOnInit(): void {
    const maximumSessionTimeoutPolicyData$ = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.policyService.policiesByType$(PolicyType.MaximumVaultTimeout, userId),
      ),
      getFirstPolicy,
      filter((policy) => policy != null),
      map((policy) => policy.data as MaximumSessionTimeoutPolicyData),
    );

    this.policyTimeoutMessage$ = maximumSessionTimeoutPolicyData$.pipe(
      switchMap((policyData) => this.getPolicyTimeoutMessage(policyData)),
    );

    maximumSessionTimeoutPolicyData$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((policyData) => {
        this.maxSessionTimeoutPolicyData = policyData;
        // Re-validate custom form group with new policy data
        this.form.controls.custom.updateValueAndValidity();
        // Trigger validator change when policy data changes
        if (this.validatorChange) {
          this.validatorChange();
        }
      });

    // Subscribe to form value changes
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      if (this.onChange) {
        const vaultTimeout = this.getVaultTimeout(value);
        if (vaultTimeout != null) {
          // Only call onChange if the form is valid
          // For non-numeric values, we don't need to validate custom fields
          const isValid = !this.isCustomTimeoutType || this.form.controls.custom.valid;
          if (isValid) {
            this.onChange(vaultTimeout);
          }
        }
      }
    });

    // Assign the current value to the custom fields
    // so that if the user goes from a numeric value to custom
    // we can initialize the custom fields with the current value
    // ex: user picks 5 min, goes to custom, we want to show 0 hr, 5 min in the custom fields
    this.form.controls.vaultTimeout.valueChanges
      .pipe(
        filter((value) => value !== VaultTimeoutStringType.Custom),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => {
        const current = typeof value === "string" ? 0 : Math.max(value ?? 0, 0);

        // This cannot emit an event b/c it would cause form.valueChanges to fire again
        // and we are already handling that above so just silently update
        // custom fields when vaultTimeout changes to a non-custom value
        this.form.patchValue(
          {
            custom: {
              hours: Math.floor(current / 60),
              minutes: current % 60,
            },
          },
          { emitEvent: false },
        );

        this.form.controls.custom.markAllAsTouched();
      });
  }

  get maxSessionTimeoutPolicyHours(): number {
    return Math.floor((this.maxSessionTimeoutPolicyData?.minutes ?? 0) / 60);
  }

  get maxSessionTimeoutPolicyMinutes(): number {
    return (this.maxSessionTimeoutPolicyData?.minutes ?? 0) % 60;
  }

  writeValue(value: VaultTimeout): void {
    if (value == null) {
      return;
    }

    // Normalize the custom numeric value to preset (i.e. 1 minute), otherwise set as custom
    const options = this.availableTimeoutOptions();
    const matchingOption = options.some((opt) => opt.value === value);
    if (!matchingOption) {
      this.logService.debug(
        `[SessionTimeoutInputComponent] form control write value as custom ${value}`,
      );
      this.form.setValue({
        vaultTimeout: VaultTimeoutStringType.Custom,
        custom: {
          hours: Math.floor((value as number) / 60),
          minutes: (value as number) % 60,
        },
      });
      return;
    }

    this.logService.debug(
      `[SessionTimeoutInputComponent] form control write value as preset ${value}`,
    );

    // For string values (e.g., "onLocked", "never"), set directly
    this.form.patchValue({
      vaultTimeout: value,
    });
  }

  registerOnChange(onChange: (vaultTimeout: VaultTimeout) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(_onTouched: () => void): void {
    // Empty
  }

  setDisabledState?(_isDisabled: boolean): void {
    // Empty
  }

  validate(_: AbstractControl): ValidationErrors | null {
    return this.form.errors;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.validatorChange = fn;
  }

  private getTotalMinutesFromCustomValue(customValue: SessionTimeoutFormValue["custom"]): number {
    const hours = customValue?.hours ?? 0;
    const minutes = customValue?.minutes ?? 0;
    return hours * 60 + minutes;
  }

  private formValidator(control: AbstractControl): ValidationErrors | null {
    const formValue = control.value as SessionTimeoutFormValue;
    const isCustomMode = formValue.vaultTimeout === VaultTimeoutStringType.Custom;

    // Only validate when in custom mode
    if (!isCustomMode) {
      return null;
    }

    const hours = formValue.custom?.hours;
    const minutes = formValue.custom?.minutes;

    if (hours == null || minutes == null) {
      return { required: true };
    }

    const totalMinutes = this.getTotalMinutesFromCustomValue(formValue.custom);
    if (totalMinutes === 0) {
      return { minTimeoutError: true };
    }

    if (this.exceedsPolicyMaximumTimeout) {
      return { maxTimeoutError: true };
    }

    return null;
  }

  private getVaultTimeout(value: SessionTimeoutFormValue): VaultTimeout | null {
    if (value.vaultTimeout !== VaultTimeoutStringType.Custom) {
      return value.vaultTimeout ?? null;
    }

    return this.getTotalMinutesFromCustomValue(value.custom);
  }

  private async getPolicyTimeoutMessage(
    policyData: MaximumSessionTimeoutPolicyData,
  ): Promise<string | null> {
    const timeout = await this.getPolicyAppliedTimeout(policyData);

    switch (timeout) {
      case VaultTimeoutNumberType.Immediately:
        return this.i18nService.t("sessionTimeoutSettingsPolicySetDefaultTimeoutToImmediately");
      case VaultTimeoutStringType.OnLocked:
        return this.i18nService.t("sessionTimeoutSettingsPolicySetDefaultTimeoutToOnLocked");
      case VaultTimeoutStringType.OnRestart:
        return this.i18nService.t("sessionTimeoutSettingsPolicySetDefaultTimeoutToOnRestart");
      case null:
        return null;
      default:
        if (isVaultTimeoutTypeNumeric(timeout)) {
          const hours = Math.floor((timeout as number) / 60);
          const minutes = (timeout as number) % 60;
          return this.i18nService.t(
            "sessionTimeoutSettingsPolicySetMaximumTimeoutToHoursMinutes",
            hours,
            minutes,
          );
        }
        throw new Error("Invalid timeout parameter");
    }
  }

  private async getPolicyAppliedTimeout(
    policyData: MaximumSessionTimeoutPolicyData,
  ): Promise<VaultTimeout | null> {
    switch (policyData.type) {
      case "immediately":
        return await this.sessionTimeoutTypeService.getHighestAvailable(
          VaultTimeoutNumberType.Immediately,
        );
      case "onSystemLock":
        return await this.sessionTimeoutTypeService.getHighestAvailable(
          VaultTimeoutStringType.OnLocked,
        );
      case "onAppRestart":
        return VaultTimeoutStringType.OnRestart;
      case "never":
        return await this.sessionTimeoutTypeService.getHighestAvailable(
          VaultTimeoutStringType.Never,
        );
      case "custom":
      default:
        return policyData.minutes;
    }
  }
}
