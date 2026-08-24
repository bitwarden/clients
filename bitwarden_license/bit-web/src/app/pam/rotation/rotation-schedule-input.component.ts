import { ChangeDetectionStrategy, Component, forwardRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  ControlValueAccessor,
  FormBuilder,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  ValidationErrors,
  Validator,
} from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FormFieldModule, SelectModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  PRESET_CRONS,
  QuartzSchedulePreset,
  isLikelyQuartzCron,
  presetForCron,
} from "./helpers/quartz-cron";

/**
 * CVA sub-editor for a Quartz cron schedule (or null for "no schedule").
 *
 * Presents a preset `bit-select` (None / Hourly / Every 6 hours / Daily / Weekly /
 * Monthly / Custom) plus, when Custom is selected, a free-text input. The outer value
 * is `string | null`:
 *
 * - `null` → None (no scheduled rotation)
 * - one of {@link PRESET_CRONS} values → the matching preset
 * - any other string → Custom
 *
 * Client validation is advisory; the server is authoritative and enforces a
 * 15-minute interval floor.  Server 400s should be surfaced via a toast.
 *
 * Usage: `<app-rotation-schedule-input formControlName="scheduleCron" />`
 */
@Component({
  selector: "app-rotation-schedule-input",
  templateUrl: "./rotation-schedule-input.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, I18nPipe, FormFieldModule, SelectModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RotationScheduleInputComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => RotationScheduleInputComponent),
      multi: true,
    },
  ],
})
export class RotationScheduleInputComponent implements ControlValueAccessor, Validator {
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18nService);

  /** Expose preset const for template comparisons. */
  protected readonly QuartzSchedulePreset = QuartzSchedulePreset;

  protected readonly presetControl = this.fb.nonNullable.control<QuartzSchedulePreset>(
    QuartzSchedulePreset.None,
  );
  protected readonly customControl = this.fb.nonNullable.control<string>("");

  // ControlValueAccessor wiring — reassigned by Angular.
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private onChange: (value: string | null) => void = () => {};
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private onTouched: () => void = () => {};
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private onValidatorChange: () => void = () => {};

  constructor() {
    // Propagate outward whenever preset OR custom text changes.
    this.presetControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.emitValue();
      this.onValidatorChange();
    });
    this.customControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.emitValue();
      this.onValidatorChange();
    });
  }

  // --- ControlValueAccessor ---

  writeValue(value: string | null): void {
    const preset = presetForCron(value);
    this.presetControl.setValue(preset, { emitEvent: false });
    if (preset === QuartzSchedulePreset.Custom) {
      this.customControl.setValue(value ?? "", { emitEvent: false });
    } else {
      this.customControl.setValue("", { emitEvent: false });
    }
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.presetControl.disable({ emitEvent: false });
      this.customControl.disable({ emitEvent: false });
    } else {
      this.presetControl.enable({ emitEvent: false });
      this.customControl.enable({ emitEvent: false });
    }
  }

  // --- Validator ---

  validate(_control: AbstractControl): ValidationErrors | null {
    const preset = this.presetControl.value;
    if (preset !== QuartzSchedulePreset.Custom) {
      return null;
    }
    const raw = this.customControl.value.trim();
    if (raw === "") {
      // Empty custom field — treat same as None; caller may require a value separately.
      return null;
    }
    if (!isLikelyQuartzCron(raw)) {
      return {
        invalidCron: { message: this.i18n.t("pamRotationScheduleInvalidCron") },
      };
    }
    return null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  // --- Template event handlers ---

  protected markTouched(): void {
    this.onTouched();
  }

  // --- Private helpers ---

  private emitValue(): void {
    this.onChange(this.currentValue);
  }

  private get currentValue(): string | null {
    const preset = this.presetControl.value;
    if (preset === QuartzSchedulePreset.None) {
      return null;
    }
    if (preset === QuartzSchedulePreset.Custom) {
      const raw = this.customControl.value.trim();
      return raw === "" ? null : raw;
    }
    return PRESET_CRONS[preset as keyof typeof PRESET_CRONS] ?? null;
  }
}
