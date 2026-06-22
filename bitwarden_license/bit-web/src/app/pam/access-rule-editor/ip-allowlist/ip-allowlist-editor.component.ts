import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  forwardRef,
  inject,
  input,
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
} from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  FormFieldModule,
  IconButtonModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  atLeastOneNonEmptyCidrValidator,
  cidrValidator,
  noDuplicateCidrsValidator,
} from "./cidr.validator";

/**
 * Editor for the `ip_allowlist` access rule.
 *
 * Presents a repeatable list of CIDR inputs. Implements {@link ControlValueAccessor}
 * and {@link Validator} so the host binds it with `formControlName` and reads the
 * value (and validity) straight off the parent form — no `viewChild` reach-in. The
 * control value is the trimmed CIDR list; empty rows stay in the value and are
 * filtered out by the host when serialising the rule.
 */
@Component({
  selector: "app-pam-ip-allowlist-editor",
  templateUrl: "./ip-allowlist-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    I18nPipe,
    AsyncActionsModule,
    ButtonModule,
    FormFieldModule,
    IconButtonModule,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => IpAllowlistEditorComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => IpAllowlistEditorComponent),
      multi: true,
    },
  ],
})
export class IpAllowlistEditorComponent implements OnInit, ControlValueAccessor, Validator {
  /** Whether the form fields should be read-only. */
  readonly readonly = input<boolean>(false);

  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18nService);

  protected readonly cidrArray = this.fb.nonNullable.array<string>(
    [],
    [noDuplicateCidrsValidator(), atLeastOneNonEmptyCidrValidator()],
  );

  // Reassigned by Angular's ControlValueAccessor / Validator wiring.
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private onChange: (value: string[]) => void = () => {};
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private onTouched: () => void = () => {};
  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties
  private onValidatorChange: () => void = () => {};

  constructor() {
    this.cidrArray.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.onChange(this.currentCidrs);
      this.onValidatorChange();
    });
  }

  ngOnInit(): void {
    // Belt-and-suspenders for non-form usage: writeValue seeds the rows when a
    // control is bound; without one, start with a single blank row to type into.
    if (this.cidrArray.length === 0) {
      this.appendRow("", false);
    }
  }

  // --- ControlValueAccessor ---

  writeValue(value: string[] | null): void {
    this.cidrArray.clear({ emitEvent: false });
    const initial = value ?? [];
    if (initial.length > 0) {
      for (const cidr of initial) {
        this.appendRow(cidr, false);
      }
    } else {
      this.appendRow("", false);
    }
    this.cidrArray.updateValueAndValidity({ emitEvent: false });
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.cidrArray.disable({ emitEvent: false });
    } else {
      this.cidrArray.enable({ emitEvent: false });
    }
  }

  // --- Validator ---

  validate(control: AbstractControl): ValidationErrors | null {
    // Once the host control is touched (e.g. a submit attempt), surface the inline
    // row/array errors by mirroring the touched state into the internal array.
    if (control.touched && !this.cidrArray.touched) {
      this.cidrArray.markAllAsTouched();
    }
    return this.cidrArray.valid ? null : { ipAllowlist: true };
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  // --- Template actions ---

  protected addRow(): void {
    this.appendRow("");
    this.onTouched();
  }

  protected removeRow(index: number): void {
    this.cidrArray.removeAt(index);
    // Keep at least one row so the user always has an input to type into.
    if (this.cidrArray.length === 0) {
      this.appendRow("");
    }
    this.onTouched();
  }

  protected markTouched(): void {
    this.onTouched();
  }

  private get currentCidrs(): string[] {
    return this.cidrArray.controls.map((c) => c.value.trim());
  }

  private appendRow(value: string, emitEvent = true): void {
    this.cidrArray.push(
      this.fb.control(value, {
        nonNullable: true,
        validators: [cidrValidator(this.i18n.t("accessRuleIpAllowlistInvalidCidr"))],
      }),
      { emitEvent },
    );
  }
}
