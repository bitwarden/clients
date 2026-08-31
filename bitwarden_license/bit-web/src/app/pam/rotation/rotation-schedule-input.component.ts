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

import { QuartzSchedulePreset } from "./rotation";
import { RotationSdkService } from "./rotation-sdk.service";


/**
 * CVA sub-editor for a Quartz cron schedule (or null for "no schedule").
 *
 * Presents a preset `bit-select` (None / Hourly / Every 6 hours / Daily / Weekly /
 * Monthly / Custom) plus, when Custom is selected, a free-text input. The outer value
 * is `string | null`:
 *
 * - `null` → None (no scheduled rotation)
 * - a preset's cron expression → the matching preset
 * - any other string → Custom
 *
 * Every cron rule here — which expression a preset maps to, which preset an expression matches,
 * and whether a custom expression is Quartz-shaped — belongs to the SDK, so this component asks
 * rather than reimplements. Those calls are asynchronous (reaching the SDK needs a client) while
 * `ControlValueAccessor` and `Validator` are not, so the preset table is resolved once on
 * construction and the last shape verdict is kept, re-running validation when it lands.
 *
 * Client validation is advisory; the server is authoritative and enforces a
 * 15-minute interval floor. Server rejections should be surfaced via a toast.
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
  private readonly rotationSdk = inject(RotationSdkService);

  /** Preset → cron expression, resolved once from the SDK. Empty until that read lands. */
  private readonly cronByPreset = new Map<QuartzSchedulePreset, string>();

  /**
   * Whether the custom expression currently looks like Quartz.
   *
   * Cached because {@link validate} is synchronous. Starts `true` so a control is never reported
   * invalid on the strength of a check that has not run yet.
   */
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private cronShapeValid = true;

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
    void this.loadPresetCrons();

    // Propagate outward whenever preset OR custom text changes.
    this.presetControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.emitValue();
      this.onValidatorChange();
    });
    this.customControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.emitValue();
      void this.refreshCronShape(value);
    });
  }

  /**
   * Resolves each named preset's cron expression from the SDK.
   *
   * `None` and `Custom` have no fixed expression, so they are absent from the table by design —
   * {@link currentValue} handles both before consulting it.
   */
  private async loadPresetCrons(): Promise<void> {
    const named = [
      QuartzSchedulePreset.Hourly,
      QuartzSchedulePreset.Every6Hours,
      QuartzSchedulePreset.Daily,
      QuartzSchedulePreset.Weekly,
      QuartzSchedulePreset.Monthly,
    ];
    const crons = await Promise.all(named.map((preset) => this.rotationSdk.cronForPreset(preset)));
    named.forEach((preset, index) => {
      const cron = crons[index];
      if (cron != null) {
        this.cronByPreset.set(preset, cron);
      }
    });
    // A preset selected before the table landed emitted null; re-emit now that it resolves.
    this.emitValue();
  }

  /** Re-checks the custom expression's shape and re-runs validation once the verdict is in. */
  private async refreshCronShape(value: string): Promise<void> {
    const raw = value.trim();
    // An empty field is "no schedule", not a malformed one — see validate().
    this.cronShapeValid = raw === "" || (await this.rotationSdk.isLikelyQuartzCron(raw));
    this.onValidatorChange();
  }

  // --- ControlValueAccessor ---

  writeValue(value: string | null): void {
    // Asking the SDK which preset this is takes a turn; the controls settle when it answers.
    void this.applyPreset(value);
  }

  private async applyPreset(value: string | null): Promise<void> {
    const preset = await this.rotationSdk.presetForCron(value);
    this.presetControl.setValue(preset, { emitEvent: false });
    if (preset === QuartzSchedulePreset.Custom) {
      this.customControl.setValue(value ?? "", { emitEvent: false });
      await this.refreshCronShape(value ?? "");
    } else {
      this.customControl.setValue("", { emitEvent: false });
      this.cronShapeValid = true;
      this.onValidatorChange();
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
    if (this.cronShapeValid) {
      return null;
    }
    return {
      invalidCron: { message: this.i18n.t("pamRotationScheduleInvalidCron") },
    };
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
    return this.cronByPreset.get(preset) ?? null;
  }
}
