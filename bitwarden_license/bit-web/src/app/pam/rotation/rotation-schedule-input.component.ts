import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  forwardRef,
  inject,
} from "@angular/core";
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
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { merge, tap } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FormFieldModule, SelectModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { QuartzSchedulePreset } from "./rotation";
import { RotationSdkService } from "./rotation-sdk.service";

/** The interval builder's mode value. */
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
const MAX_INTERVAL_COUNT: Readonly<Record<ScheduleIntervalUnit, number>> = Object.freeze({
  [ScheduleIntervalUnit.Days]: 31,
  [ScheduleIntervalUnit.Months]: 12,
});

const MAX_HOUR = 23;
const MAX_MINUTE = 59;

/** `<input type="time">` emits "HH:MM"; seconds are accepted and dropped. */
const TIME_OF_DAY = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

/** Rejects a fractional count. */
function wholeNumber(message: string): ValidatorFn {
  return ({ value }) =>
    value == null || Number.isInteger(value) ? null : { notWholeNumber: { message } };
}

/** A bare or zero-padded cron clock field, or `null` when it is not a number within `max`. */
function clockField(field: string, max: number): number | null {
  if (!/^\d{1,2}$/.test(field)) {
    return null;
  }
  const value = Number(field);
  return value <= max ? value : null;
}

/** The step `N` a `*` or `1/N` cron field carries, or `null` when it is neither or out of range. */
function intervalStep(field: string, unit: ScheduleIntervalUnit): number | null {
  if (field === "*") {
    return 1;
  }
  const match = /^1\/(\d{1,2})$/.exec(field);
  if (match == null) {
    return null;
  }
  const step = Number(match[1]);
  return step >= 1 && step <= MAX_INTERVAL_COUNT[unit] ? step : null;
}

/** Preset → the key of the sentence describing what it does. */
const SCHEDULE_ECHO_KEYS: Partial<Record<QuartzSchedulePreset, string>> = {
  [QuartzSchedulePreset.None]: "pamRotationScheduleEchoNone",
  [QuartzSchedulePreset.Hourly]: "pamRotationScheduleEchoHourly",
  [QuartzSchedulePreset.Every6Hours]: "pamRotationScheduleEchoEvery6Hours",
  [QuartzSchedulePreset.Daily]: "pamRotationScheduleEchoDaily",
  [QuartzSchedulePreset.Weekly]: "pamRotationScheduleEchoWeekly",
  [QuartzSchedulePreset.Monthly]: "pamRotationScheduleEchoMonthly",
};

/** Interval unit → the sentence for a count of one, and the sentence for any other count. */
const INTERVAL_ECHO_KEYS: Readonly<Record<ScheduleIntervalUnit, { one: string; many: string }>> =
  Object.freeze({
    [ScheduleIntervalUnit.Days]: {
      one: "pamRotationScheduleEchoIntervalDay",
      many: "pamRotationScheduleEchoIntervalDays",
    },
    [ScheduleIntervalUnit.Months]: {
      one: "pamRotationScheduleEchoIntervalMonth",
      many: "pamRotationScheduleEchoIntervalMonths",
    },
  });

/** What the echo line renders: a message key, plus the parameters that message takes. */
interface ScheduleEcho {
  key: string;
  p1?: string | number;
  p2?: string | number;
}

/** A clock reading as `<input type="time">` and the SDK's presets both spell it: zero-padded. */
function timeOfDay(hh: number, mm: number): string {
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * CVA sub-editor for a Quartz cron schedule (or null for "no schedule").
 *
 * The outer value is `string | null`: `null` for None, a preset's own cron expression for that
 * preset, an expression the interval builder could have composed for Interval, any other string
 * for Custom.
 *
 * Every cron rule belongs to the SDK, not this component — which preset an expression maps to,
 * and whether a custom one is Quartz-shaped, is resolved there and re-validated asynchronously.
 *
 * Client validation is advisory; the server enforces a 15-minute interval floor.
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
  private readonly cdr = inject(ChangeDetectorRef);

  /** Preset → cron expression, resolved from the SDK on construction; empty until that read lands. */
  private readonly cronByPreset = new Map<QuartzSchedulePreset, string>();

  /**
   * Whether the custom expression looks like Quartz, cached since {@link validate} is
   * synchronous. Starts `true` so a control is not reported invalid before the check runs.
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
  protected readonly customControl = this.fb.nonNullable.control<string>("", () =>
    this.cronShapeValid ? null : { invalidCron: { message: this.invalidCronMessage() } },
  );
  protected readonly intervalCountControl = this.fb.nonNullable.control<number | null>(
    1,
    this.countValidators(ScheduleIntervalUnit.Days),
  );
  protected readonly intervalUnitControl = this.fb.nonNullable.control<ScheduleIntervalUnit>(
    ScheduleIntervalUnit.Days,
  );
  protected readonly intervalTimeControl = this.fb.nonNullable.control<string>("00:00", [
    Validators.required,
  ]);

  private readonly editorControls: readonly AbstractControl[] = [
    this.presetControl,
    this.customControl,
    this.intervalCountControl,
    this.intervalUnitControl,
    this.intervalTimeControl,
  ];

  // ControlValueAccessor wiring, reassigned by Angular.
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private onChange: (value: string | null) => void = () => {};
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private onTouched: () => void = () => {};
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private onValidatorChange: () => void = () => {};

  constructor() {
    void this.loadPresetCrons();

    // Propagates outward on any preset or custom-text change.
    this.presetControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.emitValue();
      this.onValidatorChange();
    });
    this.customControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.emitValue();
      void this.refreshCronShape(value);
    });
    merge(
      this.intervalCountControl.valueChanges,
      this.intervalTimeControl.valueChanges,
      this.intervalUnitControl.valueChanges.pipe(tap((unit) => this.applyCountBounds(unit))),
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.emitValue();
        this.onValidatorChange();
      });
  }

  protected get intervalCountMax(): number {
    return MAX_INTERVAL_COUNT[this.intervalUnitControl.value];
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
    this.emitValue();
    this.cdr.markForCheck();
  }

  /** Re-checks the custom expression's shape and re-validates against the new verdict. */
  private async refreshCronShape(value: string): Promise<void> {
    const raw = value.trim();
    // An empty field is "no schedule", not a malformed one — see validate().
    this.cronShapeValid = raw === "" || (await this.rotationSdk.isLikelyQuartzCron(raw));
    this.customControl.updateValueAndValidity({ emitEvent: false });
    this.onValidatorChange();
    this.cdr.markForCheck();
  }

  private invalidCronMessage(): string {
    return this.i18n.t("pamRotationScheduleInvalidCron");
  }

  writeValue(value: string | null): void {
    // Asking the SDK which preset this is takes a turn; controls settle after it answers.
    void this.applyPreset(value);
  }

  private async applyPreset(value: string | null): Promise<void> {
    const preset = await this.rotationSdk.presetForCron(value);
    // A named preset wins over the builder: an expression the SDK names stays a named preset.
    if (preset !== QuartzSchedulePreset.Custom) {
      this.presetControl.setValue(preset, { emitEvent: false });
      this.resetCustom();
      this.resetInterval();
      this.acceptKnownShape();
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
      this.acceptKnownShape();
      return;
    }

    this.presetControl.setValue(QuartzSchedulePreset.Custom, { emitEvent: false });
    this.resetInterval();
    this.customControl.setValue(value ?? "", { emitEvent: false });
    await this.refreshCronShape(value ?? "");
  }

  /** Settles a value this component recognised: nothing is left for the shape check to judge. */
  private acceptKnownShape(): void {
    this.cronShapeValid = true;
    this.onValidatorChange();
    this.cdr.markForCheck();
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
    for (const control of this.editorControls) {
      if (isDisabled) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    }
  }

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
      invalidCron: { message: this.invalidCronMessage() },
    };
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  protected markTouched(): void {
    this.onTouched();
  }

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

  /**
   * The plain-English echo rendered beneath the control, or `null` when there is nothing honest to
   * say — an incomplete builder and an empty or malformed custom expression each describe no
   * schedule.
   */
  protected get scheduleEcho(): ScheduleEcho | null {
    const preset = this.presetControl.value;
    if (preset === SCHEDULE_INTERVAL_MODE) {
      const parts = this.intervalParts();
      if (parts == null) {
        return null;
      }
      const keys = INTERVAL_ECHO_KEYS[parts.unit];
      const time = timeOfDay(parts.hh, parts.mm);
      return parts.count === 1
        ? { key: keys.one, p1: time }
        : { key: keys.many, p1: parts.count, p2: time };
    }
    const key = SCHEDULE_ECHO_KEYS[preset];
    if (key != null) {
      return preset === QuartzSchedulePreset.None || this.cronByPreset.has(preset) ? { key } : null;
    }
    if (!this.cronShapeValid) {
      return null;
    }
    const cron = this.currentValue;
    return cron == null ? null : { key: "pamRotationScheduleEchoCustom", p1: cron };
  }

  private countValidators(unit: ScheduleIntervalUnit): ValidatorFn[] {
    return [
      Validators.required,
      Validators.min(1),
      Validators.max(MAX_INTERVAL_COUNT[unit]),
      wholeNumber(this.i18n.t("pamRotationScheduleIntervalCountWholeNumber")),
    ];
  }

  private applyCountBounds(unit: ScheduleIntervalUnit): void {
    this.intervalCountControl.setValidators(this.countValidators(unit));
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
    const max = MAX_INTERVAL_COUNT[unit];
    if (count == null || !Number.isInteger(count) || count < 1 || count > max) {
      return null;
    }
    const match = TIME_OF_DAY.exec(this.intervalTimeControl.value.trim());
    if (match == null) {
      return null;
    }
    const hh = clockField(match[1], MAX_HOUR);
    const mm = clockField(match[2], MAX_MINUTE);
    if (hh == null || mm == null) {
      return null;
    }
    return { count, unit, hh, mm };
  }

  /** The Quartz expression for the builder's current parts, or `null` when they are incomplete. */
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

  /** The builder's controls for an expression it could have produced, or `null`. */
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
    const hh = clockField(hour, MAX_HOUR);
    const mm = clockField(minute, MAX_MINUTE);
    if (hh == null || mm == null) {
      return null;
    }
    const time = timeOfDay(hh, mm);

    if (month === "*") {
      if (dom === "1") {
        return { count: 1, unit: ScheduleIntervalUnit.Months, time };
      }
      const count = intervalStep(dom, ScheduleIntervalUnit.Days);
      return count == null ? null : { count, unit: ScheduleIntervalUnit.Days, time };
    }
    if (dom !== "1") {
      return null;
    }
    const count = intervalStep(month, ScheduleIntervalUnit.Months);
    return count == null || count === 1 ? null : { count, unit: ScheduleIntervalUnit.Months, time };
  }
}
