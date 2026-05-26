import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  forwardRef,
  input,
  OnInit,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  ControlValueAccessor,
  FormBuilder,
  FormGroup,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  Validator,
  ValidationErrors,
} from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { FormFieldModule, SelectModule } from "@bitwarden/components";

interface DateParts {
  month: string;
  day: string;
  year: string;
}

@Component({
  selector: "vault-date-field-group",
  templateUrl: "./date-field-group.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, FormFieldModule, SelectModule, JslibModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateFieldGroupComponent),
      multi: true,
    },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => DateFieldGroupComponent), multi: true },
  ],
})
export class DateFieldGroupComponent implements OnInit, ControlValueAccessor, Validator {
  readonly monthLabel = input<string>("");
  readonly dayLabel = input<string>("");
  readonly yearLabel = input<string>("");

  readonly dateFieldGroup = viewChild<ElementRef<HTMLDivElement>>("dateFieldGroup");
  readonly months: Array<{ name: string; value: string }>;
  readonly internalForm: FormGroup;

  // These callbacks are reassigned by Angular's ControlValueAccessor interface
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private onChange = (value: string) => {};
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private onTouched = () => {};
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private onValidatorChange = () => {};

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly i18nService: I18nService,
    private readonly destroyRef: DestroyRef,
  ) {
    this.months = [
      { name: "-- " + this.i18nService.t("select") + " --", value: "" },
      { name: this.i18nService.t("january"), value: "1" },
      { name: this.i18nService.t("february"), value: "2" },
      { name: this.i18nService.t("march"), value: "3" },
      { name: this.i18nService.t("april"), value: "4" },
      { name: this.i18nService.t("may"), value: "5" },
      { name: this.i18nService.t("june"), value: "6" },
      { name: this.i18nService.t("july"), value: "7" },
      { name: this.i18nService.t("august"), value: "8" },
      { name: this.i18nService.t("september"), value: "9" },
      { name: this.i18nService.t("october"), value: "10" },
      { name: this.i18nService.t("november"), value: "11" },
      { name: this.i18nService.t("december"), value: "12" },
    ];

    this.internalForm = this.formBuilder.group({
      month: [""],
      day: [""],
      year: [""],
    });
  }

  ngOnInit(): void {
    this.setupNumericFilter(this.internalForm.get("day")!);
    this.setupNumericFilter(this.internalForm.get("year")!);

    this.internalForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.validateDayRange();
      const combined = this.combineDate(
        this.internalForm.get("month")!.value,
        this.internalForm.get("day")!.value,
        this.internalForm.get("year")!.value,
      );
      this.onChange(combined);
      this.onValidatorChange();
    });
  }

  writeValue(value: string | null | undefined): void {
    if (!value) {
      this.internalForm.patchValue({ month: "", day: "", year: "" }, { emitEvent: false });
      return;
    }
    const parts = this.parseDateParts(value);
    this.internalForm.patchValue(parts, { emitEvent: false });
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.internalForm.disable({ emitEvent: false });
    } else {
      this.internalForm.enable({ emitEvent: false });
    }
  }

  validate(): ValidationErrors | null {
    const monthControl = this.internalForm.get("month")! as AbstractControl<string>;
    const dayControl = this.internalForm.get("day")! as AbstractControl<string>;
    const yearControl = this.internalForm.get("year")! as AbstractControl<string>;

    const values = [
      monthControl.value?.trim(),
      dayControl.value?.trim(),
      yearControl.value?.trim(),
    ];

    const anyFilled = values.some((v) => !!v);
    const allFilled = values.every((v) => !!v);

    if (!anyFilled) {
      return null;
    }

    if (!allFilled || this.internalForm.invalid) {
      const fieldCount = values.filter((v) => !v).length || 1;
      return { invalidDate: true, fieldCount };
    }

    return null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  onGroupBlur(event: FocusEvent): void {
    if (this.dateFieldGroup()?.nativeElement.contains(event.relatedTarget as HTMLElement)) {
      return;
    }

    this.internalForm.get("month")!.markAsTouched();
    this.internalForm.get("day")!.markAsTouched();
    this.internalForm.get("year")!.markAsTouched();
    this.validateAllOrNothing();
  }

  /**
   * Parses a date string in YYYY-MM-DD or YYYY-M-D format
   * back into discrete month, day, year fields.
   * Handles both zero-padded and non-padded formats.
   */
  private parseDateParts(dateStr: string): DateParts {
    if (!dateStr) {
      return { month: "", day: "", year: "" };
    }
    const [year = "", month = "", day = ""] = dateStr.split("-");
    return {
      month: month ? String(parseInt(month, 10)) : "",
      day: day ? String(parseInt(day, 10)) : "",
      year,
    };
  }

  /**
   * Combines month, day, year into a YYYY-MM-DD string with zero-padding.
   * Returns "" when all parts are empty.
   */
  private combineDate(
    month: string | null | undefined,
    day: string | null | undefined,
    year: string | null | undefined,
  ): string {
    if (!month && !day && !year) {
      return "";
    }
    if (!month || !day || !year) {
      // Partial dates are allowed as input, but not returned unless all empty
      return "";
    }
    const monthPadded = String(month).padStart(2, "0");
    const dayPadded = String(day).padStart(2, "0");
    return `${year}-${monthPadded}-${dayPadded}`;
  }

  /**
   * Strips non-digit characters after each keystroke.
   */
  private setupNumericFilter(ctrl: AbstractControl): void {
    ctrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value: string) => {
      if (!value) {
        return;
      }
      const filtered = value.replace(/\D/g, "");
      if (filtered !== value) {
        ctrl.setValue(filtered, { emitEvent: false });
      }
    });
  }

  /**
   * All-or-nothing validation: if any field is filled, all must be filled.
   * Only applies errors if user has left the date field group (touched state set).
   */
  private validateAllOrNothing(): void {
    const monthCtrl = this.internalForm.get("month")!;
    const dayCtrl = this.internalForm.get("day")!;
    const yearCtrl = this.internalForm.get("year")!;

    const monthFilled = !!monthCtrl.value;
    const dayFilled = !!(dayCtrl.value as string)?.trim();
    const yearFilled = !!(yearCtrl.value as string)?.trim();

    const anyFilled = monthFilled || dayFilled || yearFilled;
    const anyTouched = monthCtrl.touched || dayCtrl.touched || yearCtrl.touched;
    // Only show errors if user has touched (left) any field
    if (!anyTouched || !anyFilled) {
      this.clearCrossFieldError(monthCtrl);
      this.clearCrossFieldError(dayCtrl);
      this.clearCrossFieldError(yearCtrl);
      return;
    }

    this.setCrossFieldError(monthCtrl, !monthFilled, this.i18nService.t("enterMonth"));
    this.setCrossFieldError(dayCtrl, !dayFilled, this.i18nService.t("enterDay"));
    this.setCrossFieldError(yearCtrl, !yearFilled, this.i18nService.t("enterYear"));
  }

  /**
   * Validates that the day value is valid for the selected month/year.
   * Only runs when all three fields are filled.
   */
  private validateDayRange(): void {
    const monthCtrl = this.internalForm.get("month")!;
    const dayCtrl = this.internalForm.get("day")!;
    const yearCtrl = this.internalForm.get("year")!;

    const month = monthCtrl.value;
    const day = dayCtrl.value;
    const year = yearCtrl.value;

    // Only validate when all fields are present
    if (!month || !day || !year) {
      dayCtrl.setErrors(this.removeError(dayCtrl.errors, "invalidDay"));
      return;
    }

    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);

    // Check that the year is a valid 4 digit number, anything less than 4 digits should show an error
    if (isNaN(yearNum) || year.length !== 4) {
      const errors = this.removeError(yearCtrl.errors, "crossFieldRequired");
      yearCtrl.setErrors({
        ...(errors ?? {}),
        invalidYear: { message: this.i18nService.t("invalidYear") },
      });
      return;
    } else {
      yearCtrl.setErrors(this.removeError(yearCtrl.errors, "invalidYear"));
    }

    // Check if day is valid for the selected month/year
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const isValidDay = dayNum >= 1 && dayNum <= daysInMonth;

    if (!isValidDay) {
      dayCtrl.setErrors({
        ...(dayCtrl.errors ?? {}),
        invalidDay: { message: this.i18nService.t("invalidDay") },
      });
    } else {
      dayCtrl.setErrors(this.removeError(dayCtrl.errors, "invalidDay"));
    }
  }

  /**
   * Sets or updates the crossFieldRequired error on a control.
   */
  private setCrossFieldError(ctrl: AbstractControl, shouldError: boolean, message: string): void {
    if (shouldError) {
      ctrl.setErrors({ ...(ctrl.errors ?? {}), crossFieldRequired: { message } });
    } else {
      ctrl.setErrors(this.removeError(ctrl.errors, "crossFieldRequired"));
    }
  }

  /**
   * Removes a specific error from a control's errors object.
   * Returns null if no errors remain.
   */
  private clearCrossFieldError(ctrl: AbstractControl): void {
    ctrl.setErrors(this.removeError(ctrl.errors, "crossFieldRequired"));
  }

  /**
   * Removes an error key from the errors object.
   * Returns null if no errors remain, otherwise returns the updated errors object.
   */
  private removeError(errors: ValidationErrors | null, errorKey: string): ValidationErrors | null {
    if (!errors || !errors[errorKey]) {
      return errors;
    }
    const updated = { ...errors };
    delete updated[errorKey];
    return Object.keys(updated).length ? updated : null;
  }
}
