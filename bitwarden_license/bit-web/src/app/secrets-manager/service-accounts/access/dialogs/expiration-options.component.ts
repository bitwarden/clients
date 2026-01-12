// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DatePipe } from "@angular/common";
import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import {
  AbstractControl,
  ControlValueAccessor,
  FormControl,
  FormGroup,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { Subject, takeUntil } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "sm-expiration-options",
  templateUrl: "./expiration-options.component.html",
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: ExpirationOptionsComponent,
    },
    {
      provide: NG_VALIDATORS,
      multi: true,
      useExisting: ExpirationOptionsComponent,
    },
  ],
  standalone: false,
})
export class ExpirationOptionsComponent
  implements ControlValueAccessor, Validator, OnInit, OnDestroy
{
  private destroy$ = new Subject<void>();

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() expirationDayOptions: number[];

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() set touched(val: boolean) {
    if (val) {
      this.form.markAllAsTouched();
    }
  }

  currentDate = new Date();

  protected form = new FormGroup({
    expires: new FormControl("never", [Validators.required]),
    expireDateTime: new FormControl("", [Validators.required, this.expiresInFutureValidator()]),
  });

  constructor(
    private datePipe: DatePipe,
    private i18nService: I18nService,
  ) {}

  async ngOnInit() {
    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this._onChange(this.getExpiresDate());
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private _onChange = (_value: Date | null): void => undefined;
  registerOnChange(fn: (value: Date | null) => void): void {
    this._onChange = fn;
  }

  onTouched = (): void => undefined;
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  validate(control: AbstractControl<any, any>): ValidationErrors {
    if (
      (this.form.value.expires == "custom" && !this.form.invalid) ||
      this.form.value.expires !== "custom"
    ) {
      return null;
    }
    return {
      required: true,
    };
  }

  writeValue(value: Date | null): void {
    if (value == null) {
      this.form.setValue({ expires: "never", expireDateTime: null });
    }
    if (value) {
      this.form.setValue({
        expires: "custom",
        expireDateTime: this.datePipe.transform(value, "YYYY-MM-ddThh:mm"),
      });
    }
  }

  setDisabledState?(isDisabled: boolean): void {
    isDisabled ? this.form.disable() : this.form.enable();
  }

  private getExpiresDate(): Date | null {
    if (this.form.value.expires == "never") {
      return null;
    }
    if (this.form.value.expires == "custom") {
      return new Date(this.form.value.expireDateTime);
    }
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + Number(this.form.value.expires));
    return currentDate;
  }

  expiresInFutureValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const enteredDate = new Date(control.value);

      if (enteredDate > new Date()) {
        return null;
      } else {
        return {
          ValidationError: {
            message: this.i18nService.t("expirationDateError"),
          },
        };
      }
    };
  }
}
