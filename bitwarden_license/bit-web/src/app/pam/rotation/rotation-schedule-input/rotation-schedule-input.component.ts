import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  forwardRef,
  inject,
  input,
  signal,
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
import { catchError, EMPTY, from, map, merge, of, Subject, switchMap, tap } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FormFieldModule, Option, SelectModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { QuartzSchedulePreset } from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";

import {
  composeIntervalCron,
  describeSchedule,
  intervalParts,
  MAX_INTERVAL_COUNT,
  parseIntervalCron,
  SCHEDULE_INTERVAL_MODE,
  ScheduleEcho,
  ScheduleInterval,
  ScheduleIntervalUnit,
  ScheduleMode,
  timeOfDay,
} from "./rotation-schedule";

function wholeNumber(message: string): ValidatorFn {
  return ({ value }) =>
    value == null || Number.isInteger(value) ? null : { notWholeNumber: { message } };
}

/** The schedule select's options, in display order. */
const SCHEDULE_MODE_LABEL_KEYS: ReadonlyArray<readonly [ScheduleMode, string]> = [
  [QuartzSchedulePreset.None, "pamRotationScheduleNone"],
  [QuartzSchedulePreset.Hourly, "pamRotationScheduleHourly"],
  [QuartzSchedulePreset.Every6Hours, "pamRotationScheduleEvery6Hours"],
  [QuartzSchedulePreset.Daily, "pamRotationScheduleDaily"],
  [QuartzSchedulePreset.Weekly, "pamRotationScheduleWeekly"],
  [QuartzSchedulePreset.Monthly, "pamRotationScheduleMonthly"],
  [SCHEDULE_INTERVAL_MODE, "pamRotationScheduleInterval"],
  [QuartzSchedulePreset.Custom, "pamRotationScheduleCustom"],
];

const INTERVAL_UNIT_LABEL_KEYS: ReadonlyArray<readonly [ScheduleIntervalUnit, string]> = [
  [ScheduleIntervalUnit.Days, "pamRotationScheduleIntervalUnitDays"],
  [ScheduleIntervalUnit.Months, "pamRotationScheduleIntervalUnitMonths"],
];

/**
 * Form control for a Quartz cron schedule, or `null` for none. The SDK names presets and judges a
 * custom expression's shape asynchronously; the server enforces a 15-minute interval floor.
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

  /** Resolved from the SDK on construction; empty until that read lands. */
  private readonly cronByPreset = new Map<QuartzSchedulePreset, string>();

  /**
   * Whether the custom expression looks like Quartz, cached since {@link validate} is
   * synchronous. Starts `true` so a control is not reported invalid before the check runs.
   */
  private readonly cronShapeValid = signal(true);

  readonly labelKey = input("pamRotationScheduleLabel");

  protected readonly QuartzSchedulePreset = QuartzSchedulePreset;

  protected readonly ScheduleInterval = SCHEDULE_INTERVAL_MODE;

  protected readonly modeOptions: Option<ScheduleMode>[] = SCHEDULE_MODE_LABEL_KEYS.map(
    ([value, key]) => ({ value, label: this.i18n.t(key) }),
  );
  protected readonly intervalUnitOptions: Option<ScheduleIntervalUnit>[] =
    INTERVAL_UNIT_LABEL_KEYS.map(([value, key]) => ({ value, label: this.i18n.t(key) }));

  protected readonly presetControl = this.fb.nonNullable.control<ScheduleMode>(
    QuartzSchedulePreset.None,
  );
  protected readonly customControl = this.fb.nonNullable.control<string>("", () =>
    this.cronShapeValid() ? null : { invalidCron: { message: this.invalidCronMessage() } },
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

  /** Custom expressions to shape-check; only the latest answer counts. */
  private readonly cronShapeChecks = new Subject<string>();
  /** Values written by the form; only the latest is applied. */
  private readonly writes = new Subject<string | null>();

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

    this.presetControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.emitValue();
      this.onValidatorChange();
    });
    this.customControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.emitValue();
      this.cronShapeChecks.next(value);
    });
    this.cronShapeChecks
      .pipe(
        switchMap((value) => {
          const raw = value.trim();
          // An empty field means no schedule, not a malformed one.
          if (raw === "") {
            return of(true);
          }
          // The SDK logs a failure; the field keeps its last verdict.
          return from(this.rotationSdk.isLikelyQuartzCron(raw)).pipe(catchError(() => EMPTY));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((valid) => this.applyCronShape(valid));
    this.writes
      .pipe(
        // Asking the SDK which preset this is takes a turn; controls settle after it answers.
        switchMap((value) =>
          from(this.rotationSdk.presetForCron(value)).pipe(
            map((preset) => ({ value, preset })),
            // The SDK logs a failure; the controls keep their last value.
            catchError(() => EMPTY),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ value, preset }) => this.applyPreset(value, preset));
    merge(
      this.intervalCountControl.valueChanges,
      this.intervalTimeControl.valueChanges,
      this.intervalUnitControl.valueChanges.pipe(tap((unit) => this.applyCountBounds(unit, true))),
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

  /** Skips `None` and `Custom`, which have no fixed cron; {@link currentValue} handles both. */
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

  private applyCronShape(valid: boolean): void {
    this.cronShapeValid.set(valid);
    this.customControl.updateValueAndValidity({ emitEvent: false });
    this.customControl.setErrors(this.customControl.errors);
    this.onValidatorChange();
    this.cdr.markForCheck();
  }

  private invalidCronMessage(): string {
    return this.i18n.t("pamRotationScheduleInvalidCron");
  }

  writeValue(value: string | null): void {
    this.writes.next(value);
  }

  private applyPreset(value: string | null, preset: QuartzSchedulePreset): void {
    // A named preset wins over the interval builder.
    if (preset !== QuartzSchedulePreset.Custom) {
      this.presetControl.setValue(preset, { emitEvent: false });
      this.resetCustom();
      this.resetInterval();
      this.acceptKnownShape();
      return;
    }

    const interval = value == null ? null : parseIntervalCron(value);
    if (interval != null) {
      this.presetControl.setValue(SCHEDULE_INTERVAL_MODE, { emitEvent: false });
      this.resetCustom();
      this.intervalUnitControl.setValue(interval.unit, { emitEvent: false });
      this.applyCountBounds(interval.unit);
      this.intervalCountControl.setValue(interval.count, { emitEvent: false });
      this.intervalTimeControl.setValue(timeOfDay(interval.hh, interval.mm), {
        emitEvent: false,
      });
      this.acceptKnownShape();
      return;
    }

    this.presetControl.setValue(QuartzSchedulePreset.Custom, { emitEvent: false });
    this.resetInterval();
    this.customControl.setValue(value ?? "", { emitEvent: false });
    this.cronShapeChecks.next(value ?? "");
    this.cdr.markForCheck();
  }

  /** A recognised value leaves nothing for the shape check to judge, and drops any pending one. */
  private acceptKnownShape(): void {
    this.cronShapeChecks.next("");
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
      return this.builderInterval() == null
        ? { invalidInterval: { message: this.i18n.t("pamRotationScheduleInvalidInterval") } }
        : null;
    }
    if (preset !== QuartzSchedulePreset.Custom) {
      return null;
    }
    if (this.cronShapeValid()) {
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
      const interval = this.builderInterval();
      return interval == null ? null : composeIntervalCron(interval);
    }
    if (preset === QuartzSchedulePreset.Custom) {
      const raw = this.customControl.value.trim();
      return raw === "" ? null : raw;
    }
    return this.cronByPreset.get(preset) ?? null;
  }

  /** The plain-English echo beneath the control. */
  protected scheduleEcho(): ScheduleEcho | null {
    const mode = this.presetControl.value;
    return describeSchedule({
      mode,
      interval: mode === SCHEDULE_INTERVAL_MODE ? this.builderInterval() : null,
      cronByPreset: this.cronByPreset,
      customCron:
        mode === QuartzSchedulePreset.Custom && this.cronShapeValid() ? this.currentValue : null,
    });
  }

  private countValidators(unit: ScheduleIntervalUnit): ValidatorFn[] {
    return [
      Validators.required,
      Validators.min(1),
      Validators.max(MAX_INTERVAL_COUNT[unit]),
      wholeNumber(this.i18n.t("pamRotationScheduleIntervalCountWholeNumber")),
    ];
  }

  private applyCountBounds(unit: ScheduleIntervalUnit, emitEvent = false): void {
    this.intervalCountControl.setValidators(this.countValidators(unit));
    this.intervalCountControl.updateValueAndValidity({ emitEvent });
    if (emitEvent && this.intervalCountControl.invalid) {
      this.intervalCountControl.markAsTouched();
    }
  }

  /** The builder's interval, or `null` when its controls cannot make an expression. */
  private builderInterval(): ScheduleInterval | null {
    return intervalParts(
      this.intervalCountControl.value,
      this.intervalUnitControl.value,
      this.intervalTimeControl.value,
    );
  }
}
