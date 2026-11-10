import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  forwardRef,
  inject,
  input,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import {
  ControlValueAccessor,
  FormBuilder,
  FormControl,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  ValidationErrors,
  Validator,
  Validators,
} from "@angular/forms";
import { distinctUntilChanged, map, merge } from "rxjs";

import {
  formatCompoundDuration,
  formatDuration,
  formatTimeOfDay,
  formatTimestamp,
  type RequestDurationOption,
  type RequestWindowFormValue,
  composeRequestWindow,
  snapToNearestDuration,
  startTimeSlots,
  toDateInputValue,
  toTimeInputValue,
  windowEndAt,
} from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FormFieldModule, IconButtonModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  REQUEST_WINDOW_ERROR_KEY,
  type RequestWindowError,
  requestWindowEndValidator,
  requestWindowProblemMessage,
} from "./request-access-window.validators";

const CUSTOM_OPTION = "custom";

/**
 * The human path's access window: a start picked from half-hour slots or typed, and an end picked
 * as a duration or typed. Validates the window against the rule's cap.
 */
@Component({
  selector: "app-pam-request-window-fields",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./request-window-fields.component.html",
  host: { class: "tw-block", "(focusout)": "onTouched()" },
  imports: [FormFieldModule, IconButtonModule, ReactiveFormsModule, TypographyModule, I18nPipe],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RequestWindowFieldsComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => RequestWindowFieldsComponent),
      multi: true,
    },
  ],
})
export class RequestWindowFieldsComponent implements ControlValueAccessor, Validator {
  readonly durationOptions = input.required<readonly RequestDurationOption[]>();
  /** The end duration to fall back to when a typed window cannot snap to an offered one. */
  readonly defaultSeconds = input.required<number>();
  readonly maxWindowSeconds = input.required<number | null>();
  /** When the sheet opened: the start picker's floor and its "Start now" slot. */
  readonly openedAt = input.required<Date>();

  private readonly i18nService = inject(I18nService);
  private readonly locale = inject(LOCALE_ID);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    startDate: ["", Validators.required],
    startTime: ["", Validators.required],
    endDate: ["", Validators.required],
    endTime: [
      "",
      [
        Validators.required,
        // Reads the cap live through the signal, not the value captured when the form was built.
        requestWindowEndValidator(
          () => this.maxWindowSeconds(),
          (problem, max) =>
            requestWindowProblemMessage(this.i18nService, this.locale, problem, max),
        ),
      ],
    ],
  });

  protected readonly CUSTOM_OPTION = CUSTOM_OPTION;
  protected readonly customStart = signal(false);
  protected readonly customEnd = signal(false);
  protected readonly startSlot = new FormControl("", {
    nonNullable: true,
    validators: Validators.required,
  });
  protected readonly endDuration = new FormControl("", {
    nonNullable: true,
    validators: Validators.required,
  });

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.value,
  });
  private readonly formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  /** Reactive forms ignore `min`, so `requestWindowEndValidator` is the real check. */
  protected readonly minRequestDate = computed(() => toDateInputValue(this.openedAt()));

  protected readonly minEndDate = computed(
    () => this.formValue().startDate || this.minRequestDate(),
  );

  protected readonly startSlots = computed(() => {
    const date = this.formValue().startDate;
    if (!date) {
      return [];
    }
    const openedAt = this.openedAt();
    const today = date === toDateInputValue(openedAt);
    return startTimeSlots(date, openedAt).map((value, index) => {
      const time = formatTimeOfDay(this.locale, new Date(`${date}T${value}`).getTime());
      return {
        value,
        label: today && index === 0 ? this.i18nService.t("requestAccessModalStartNow", time) : time,
      };
    });
  });

  protected readonly endOptions = computed(() => {
    const { startDate, startTime } = this.formValue();
    const start = windowEndAt(startDate, startTime, 0);
    return this.durationOptions().map((option) => {
      const duration = formatDuration(this.locale, option.seconds, "long");
      const end = windowEndAt(startDate, startTime, option.seconds);
      return {
        seconds: option.seconds,
        label:
          start == null || end == null
            ? duration
            : this.i18nService.t(
                "requestAccessModalDurationUntil",
                duration,
                this.formatWindowPoint(end, start),
              ),
      };
    });
  });

  protected readonly windowSummary = computed(() => {
    const window = composeRequestWindow(this.formValue());
    if (window == null || window.end <= window.start) {
      return null;
    }
    return this.i18nService.t(
      "requestAccessModalWindowSummary",
      formatCompoundDuration(
        this.locale,
        (window.end.getTime() - window.start.getTime()) / 1000,
        "long",
      ),
      this.formatWindowPoint(window.start),
      this.formatWindowPoint(window.end, window.start),
    );
  });

  /** The window error while the end is a duration, since the End time field carrying it is hidden. */
  protected readonly durationWindowError = computed(() => {
    this.formStatus();
    this.formValue();
    const error: RequestWindowError | undefined =
      this.form.controls.endTime.errors?.[REQUEST_WINDOW_ERROR_KEY];
    return this.customEnd() ? null : (error?.message ?? null);
  });

  // ControlValueAccessor wiring, reassigned by Angular.
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private onChange: (value: RequestWindowFormValue) => void = () => {};
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  protected onTouched: () => void = () => {};
  /** Set while {@link writeValue} applies a value from the parent, so it is not echoed back. */
  private readonly writing = signal(false);

  constructor() {
    // Subscribed to the sibling controls, not the group, to avoid re-entrant validation.
    const { startDate, startTime, endDate, endTime } = this.form.controls;
    merge(startDate.valueChanges, startTime.valueChanges, endDate.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        endTime.updateValueAndValidity();
        // Only a fresh window error from a sibling edit, so this never nags a blank End or races
        // `BitInputDirective.onInput`'s own `markAsUntouched`.
        if (endTime.errors?.[REQUEST_WINDOW_ERROR_KEY] != null) {
          endTime.markAsTouched();
        }
      });

    this.startSlot.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value === CUSTOM_OPTION) {
        this.customStart.set(true);
      } else {
        startTime.setValue(value);
      }
    });
    this.endDuration.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value === CUSTOM_OPTION) {
        this.customEnd.set(true);
      } else {
        this.followStartWithEnd();
      }
    });
    startDate.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.keepStartOnASlot());
    merge(startDate.valueChanges, startTime.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.followStartWithEnd());

    // Distinct, so the re-check in `validate` does not echo the same value back to the parent.
    this.form.valueChanges
      .pipe(
        map(() => this.form.getRawValue()),
        distinctUntilChanged(
          (a, b) =>
            a.startDate === b.startDate &&
            a.startTime === b.startTime &&
            a.endDate === b.endDate &&
            a.endTime === b.endTime,
        ),
        takeUntilDestroyed(),
      )
      .subscribe((value) => {
        if (!this.writing()) {
          this.onChange(value);
        }
      });
  }

  /** Seeds the fields, with the end following the start by the written window's span. */
  writeValue(value: RequestWindowFormValue | null): void {
    const window = value == null ? null : composeRequestWindow(value);
    this.writing.set(true);
    try {
      this.customStart.set(false);
      this.customEnd.set(false);
      if (window != null) {
        const seconds = (window.end.getTime() - window.start.getTime()) / 1000;
        this.endDuration.setValue(String(seconds), { emitEvent: false });
      }
      this.form.setValue({
        startDate: value?.startDate ?? "",
        startTime: value?.startTime ?? "",
        endDate: value?.endDate ?? "",
        endTime: value?.endTime ?? "",
      });
    } finally {
      this.writing.set(false);
    }
  }

  registerOnChange(fn: (value: RequestWindowFormValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /** Re-checks the end each time, since the window ages while the sheet sits open. */
  validate(): ValidationErrors | null {
    this.form.controls.endTime.updateValueAndValidity();
    if (this.form.valid) {
      return null;
    }
    return this.form.controls.endTime.errors ?? { required: true };
  }

  /** Shows each field's error, as the parent's own `markAllAsTouched` cannot reach them. */
  markAllAsTouched(): void {
    this.form.markAllAsTouched();
  }

  protected showStartPresets(): void {
    this.customStart.set(false);
    this.keepStartOnASlot();
  }

  protected showEndPresets(): void {
    const window = composeRequestWindow(this.form.getRawValue());
    const options = this.durationOptions();
    const seconds =
      window == null || options.length === 0
        ? this.defaultSeconds()
        : snapToNearestDuration((window.end.getTime() - window.start.getTime()) / 1000, options);
    this.customEnd.set(false);
    this.endDuration.setValue(String(seconds));
  }

  /**
   * In preset mode the start must be an offered slot, or the select renders blank, so this keeps
   * the nearest one at or after it.
   */
  private keepStartOnASlot(): void {
    if (this.customStart()) {
      return;
    }
    const { startDate, startTime } = this.form.controls;
    const slots = startDate.value ? startTimeSlots(startDate.value, this.openedAt()) : [];
    if (slots.length === 0) {
      return;
    }
    if (slots.includes(startTime.value)) {
      this.startSlot.setValue(startTime.value, { emitEvent: false });
    } else {
      this.startSlot.setValue(slots.find((slot) => slot >= startTime.value) ?? slots[0]);
    }
  }

  /** While the end is a duration, it moves with the start. */
  private followStartWithEnd(): void {
    if (this.customEnd()) {
      return;
    }
    const { startDate, startTime } = this.form.getRawValue();
    const end = windowEndAt(startDate, startTime, Number(this.endDuration.value));
    if (end != null) {
      this.form.patchValue({
        endDate: toDateInputValue(end),
        endTime: toTimeInputValue(end),
      });
    }
  }

  /** A time alone on the reference instant's day, else the date and time. */
  private formatWindowPoint(date: Date, reference?: Date): string {
    if (reference != null && toDateInputValue(date) === toDateInputValue(reference)) {
      return formatTimeOfDay(this.locale, date.getTime());
    }
    return formatTimestamp(this.locale, date.getTime());
  }
}
