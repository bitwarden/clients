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
  Validators,
} from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FormFieldModule, SelectModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { QuartzSchedulePreset } from "./rotation";
import { RotationSdkService } from "./rotation-sdk.service";

/**
 * The interval builder's mode value.
 *
 * Deliberately not a {@link QuartzSchedulePreset}: that union is the SDK's and names expressions
 * the SDK itself resolves. An interval is composed here, so it is a presentation mode the select
 * carries alongside the SDK's presets.
 */
export const SCHEDULE_INTERVAL_MODE = "interval" as const;

/** What the schedule select can hold: any SDK preset, or the interval builder. */
export type ScheduleMode = QuartzSchedulePreset | typeof SCHEDULE_INTERVAL_MODE;

/** The units the interval builder can step. Quartz steps day-of-month and month; not weeks. */
export const ScheduleIntervalUnit = Object.freeze({
  Days: "days",
  Months: "months",
} as const);
export type ScheduleIntervalUnit = (typeof ScheduleIntervalUnit)[keyof typeof ScheduleIntervalUnit];

/** Quartz day-of-month is 1-31 and month is 1-12; `1/N` beyond those is rejected. */
const MAX_DAY_INTERVAL = 31;
const MAX_MONTH_INTERVAL = 12;

/** `<input type="time">` emits "HH:MM"; seconds are accepted and dropped. */
const TIME_OF_DAY = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

/**
 * CVA sub-editor for a Quartz cron schedule (or null for "no schedule").
 *
 * Presents a preset `bit-select` (None / Hourly / Every 6 hours / Daily / Weekly /
 * Monthly / Interval / Custom) plus, when Interval is selected, a count/unit/time-of-day builder,
 * and when Custom is selected, a free-text input. The outer value is `string | null`:
 *
 * - `null` → None (no scheduled rotation)
 * - a preset's cron expression → the matching preset
 * - an expression the interval builder could have composed → Interval, with its parts filled in
 * - any other string → Custom
 *
 * Every cron rule here — which expression a preset maps to, which preset an expression matches,
 * and whether a custom expression is Quartz-shaped — belongs to the SDK, so this component asks
 * rather than reimplements. Composing an expression from operator-chosen interval parts is the one
 * exception, because the SDK exposes no builder; its inverse recognises only the two shapes this
 * component emits and everything else falls through to Custom, and therefore back to the SDK.
 * Those calls are asynchronous (reaching the SDK needs a client) while
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

  /** Expose the interval mode and its units for template comparisons. */
  protected readonly ScheduleInterval = SCHEDULE_INTERVAL_MODE;
  protected readonly ScheduleIntervalUnit = ScheduleIntervalUnit;

  protected readonly presetControl = this.fb.nonNullable.control<ScheduleMode>(
    QuartzSchedulePreset.None,
  );
  protected readonly customControl = this.fb.nonNullable.control<string>("");
  protected readonly intervalCountControl = this.fb.nonNullable.control<number | null>(1, [
    Validators.required,
    Validators.min(1),
    Validators.max(MAX_DAY_INTERVAL),
  ]);
  protected readonly intervalUnitControl = this.fb.nonNullable.control<ScheduleIntervalUnit>(
    ScheduleIntervalUnit.Days,
  );
  protected readonly intervalTimeControl = this.fb.nonNullable.control<string>("00:00", [
    Validators.required,
  ]);

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
    this.intervalCountControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.emitValue();
      this.onValidatorChange();
    });
    this.intervalTimeControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.emitValue();
      this.onValidatorChange();
    });
    this.intervalUnitControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((unit) => {
      this.applyCountBounds(unit);
      this.emitValue();
      this.onValidatorChange();
    });
  }

  /** The count field's ceiling for the unit currently selected. */
  protected get intervalCountMax(): number {
    return this.intervalUnitControl.value === ScheduleIntervalUnit.Months
      ? MAX_MONTH_INTERVAL
      : MAX_DAY_INTERVAL;
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
    // A named preset wins over the builder: an expression the SDK names stays a named preset.
    if (preset !== QuartzSchedulePreset.Custom) {
      this.presetControl.setValue(preset, { emitEvent: false });
      this.resetCustom();
      this.resetInterval();
      this.cronShapeValid = true;
      this.onValidatorChange();
      return;
    }

    const interval = value == null ? null : this.parseIntervalCron(value);
    if (interval != null) {
      this.presetControl.setValue(SCHEDULE_INTERVAL_MODE, { emitEvent: false });
      this.resetCustom();
      this.intervalUnitControl.setValue(interval.unit, { emitEvent: false });
      this.applyCountBounds(interval.unit);
      this.intervalCountControl.setValue(interval.count, { emitEvent: false });
      this.intervalTimeControl.setValue(interval.time, { emitEvent: false });
      this.cronShapeValid = true;
      this.onValidatorChange();
      return;
    }

    this.presetControl.setValue(QuartzSchedulePreset.Custom, { emitEvent: false });
    this.resetInterval();
    this.customControl.setValue(value ?? "", { emitEvent: false });
    await this.refreshCronShape(value ?? "");
  }

  private resetCustom(): void {
    this.customControl.setValue("", { emitEvent: false });
  }

  private resetInterval(): void {
    this.intervalUnitControl.setValue(ScheduleIntervalUnit.Days, { emitEvent: false });
    this.applyCountBounds(ScheduleIntervalUnit.Days);
    this.intervalCountControl.setValue(1, { emitEvent: false });
    this.intervalTimeControl.setValue("00:00", { emitEvent: false });
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
      this.intervalCountControl.disable({ emitEvent: false });
      this.intervalUnitControl.disable({ emitEvent: false });
      this.intervalTimeControl.disable({ emitEvent: false });
    } else {
      this.presetControl.enable({ emitEvent: false });
      this.customControl.enable({ emitEvent: false });
      this.intervalCountControl.enable({ emitEvent: false });
      this.intervalUnitControl.enable({ emitEvent: false });
      this.intervalTimeControl.enable({ emitEvent: false });
    }
  }

  // --- Validator ---

  validate(_control: AbstractControl): ValidationErrors | null {
    const preset = this.presetControl.value;
    if (preset === SCHEDULE_INTERVAL_MODE) {
      // An incomplete builder emits null, which the server reads as "no scheduled rotation".
      return this.intervalParts() == null
        ? { invalidInterval: { message: this.i18n.t("pamRotationScheduleInvalidInterval") } }
        : null;
    }
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
    if (preset === SCHEDULE_INTERVAL_MODE) {
      return this.composeIntervalCron();
    }
    if (preset === QuartzSchedulePreset.Custom) {
      const raw = this.customControl.value.trim();
      return raw === "" ? null : raw;
    }
    return this.cronByPreset.get(preset) ?? null;
  }

  /** Quartz's own ranges: `1/N` is day-of-month 1-31 and month 1-12. */
  private applyCountBounds(unit: ScheduleIntervalUnit): void {
    const max = unit === ScheduleIntervalUnit.Months ? MAX_MONTH_INTERVAL : MAX_DAY_INTERVAL;
    this.intervalCountControl.setValidators([
      Validators.required,
      Validators.min(1),
      Validators.max(max),
    ]);
    this.intervalCountControl.updateValueAndValidity({ emitEvent: false });
  }

  /** The builder's parts, or `null` when they cannot make an expression. */
  private intervalParts(): {
    count: number;
    unit: ScheduleIntervalUnit;
    hh: number;
    mm: number;
  } | null {
    const unit = this.intervalUnitControl.value;
    const count = this.intervalCountControl.value;
    const max = unit === ScheduleIntervalUnit.Months ? MAX_MONTH_INTERVAL : MAX_DAY_INTERVAL;
    if (count == null || !Number.isInteger(count) || count < 1 || count > max) {
      return null;
    }
    const match = TIME_OF_DAY.exec(this.intervalTimeControl.value.trim());
    if (match == null) {
      return null;
    }
    const hh = Number(match[1]);
    const mm = Number(match[2]);
    if (hh > 23 || mm > 59) {
      return null;
    }
    return { count, unit, hh, mm };
  }

  /**
   * The Quartz expression for the builder's current parts, or `null` when they are incomplete.
   *
   * Six fields, matching the shape the SDK's own presets use. Day-of-week is always `?` because
   * day-of-month is specified, which Quartz requires. A count of 1 emits `*` rather than `1/1`, so
   * every 1 day at 00:00 is the SDK's own daily expression and every 1 month at 00:00 its monthly.
   */
  private composeIntervalCron(): string | null {
    const parts = this.intervalParts();
    if (parts == null) {
      return null;
    }
    const { count, unit, hh, mm } = parts;
    const step = count === 1 ? "*" : `1/${count}`;
    return unit === ScheduleIntervalUnit.Months
      ? `0 ${mm} ${hh} 1 ${step} ?`
      : `0 ${mm} ${hh} ${step} * ?`;
  }

  /**
   * The builder's controls for an expression it could have produced, or `null`.
   *
   * The inverse of {@link composeIntervalCron}, and deliberately strict: anything it does not
   * recognise falls through to Custom rather than being approximated.
   */
  private parseIntervalCron(
    cron: string,
  ): { count: number; unit: ScheduleIntervalUnit; time: string } | null {
    const fields = cron.trim().split(/\s+/);
    if (fields.length !== 6) {
      return null;
    }
    const [second, minute, hour, dom, month, dow] = fields;
    if (second !== "0" || dow !== "?") {
      return null;
    }
    if (!/^\d{1,2}$/.test(minute) || !/^\d{1,2}$/.test(hour)) {
      return null;
    }
    const mm = Number(minute);
    const hh = Number(hour);
    if (mm > 59 || hh > 23) {
      return null;
    }
    const time = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    const stepOf = (field: string, max: number): number | null => {
      if (field === "*") {
        return 1;
      }
      const match = /^1\/(\d{1,2})$/.exec(field);
      const step = match == null ? null : Number(match[1]);
      return step != null && step >= 1 && step <= max ? step : null;
    };

    if (month === "*") {
      if (dom === "1") {
        return { count: 1, unit: ScheduleIntervalUnit.Months, time };
      }
      const count = stepOf(dom, MAX_DAY_INTERVAL);
      return count == null ? null : { count, unit: ScheduleIntervalUnit.Days, time };
    }
    if (dom !== "1") {
      return null;
    }
    const count = stepOf(month, MAX_MONTH_INTERVAL);
    return count == null || count === 1 ? null : { count, unit: ScheduleIntervalUnit.Months, time };
  }
}
