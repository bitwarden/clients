import {
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  NgZone,
  Optional,
  Self,
  input,
  model,
} from "@angular/core";
import { NgControl, Validators } from "@angular/forms";

import { BitFormFieldControl, InputTypes } from "../form-field/form-field-control";
import { BitFormFieldComponent } from "../form-field/form-field.component";

// Increments for each instance of this component
let nextId = 0;

export function inputBorderClasses(error: boolean) {
  return [
    "tw-border",
    "!tw-border-solid",
    error ? "tw-border-danger-600" : "tw-border-secondary-500",
    "focus:tw-outline-none",
  ];
}

@Directive({
  selector: "input[bitInput], select[bitInput], textarea[bitInput]",
  providers: [{ provide: BitFormFieldControl, useExisting: BitInputDirective }],
  host: {
    "[class]": "classList()",
    "[id]": "id()",
    "[attr.type]": "type()",
    "[attr.spellcheck]": "spellcheck()",
  },
})
export class BitInputDirective implements BitFormFieldControl {
  classList() {
    const classes = [
      "tw-block",
      "tw-w-full",
      "tw-h-full",
      "tw-px-1",
      "tw-text-main",
      "tw-placeholder-text-muted",
      "tw-bg-background",
      "tw-border-none",
      "focus:tw-outline-none",
      "[&:is(input,textarea):disabled]:tw-bg-secondary-100",
    ];

    if (this.parentFormField === null) {
      classes.push(...inputBorderClasses(this.hasError), ...this.standaloneInputClasses);
    }

    return classes.filter((s) => s != "");
  }

  readonly id = input(`bit-input-${nextId++}`);

  @HostBinding("attr.aria-describedby") ariaDescribedBy?: string;

  @HostBinding("attr.aria-invalid") get ariaInvalid() {
    return this.hasError ? true : undefined;
  }

  readonly type = model<InputTypes>();

  readonly spellcheck = model<boolean>();

  // TODO: Skipped for signal migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @HostBinding()
  @Input()
  get required() {
    return this._required ?? this.ngControl?.control?.hasValidator(Validators.required) ?? false;
  }
  set required(value: any) {
    this._required = value != null && value !== false;
  }
  private _required?: boolean;

  readonly hasPrefix = input(false);
  readonly hasSuffix = input(false);

  readonly showErrorsWhenDisabled = input<boolean>(false);

  get labelForId(): string {
    return this.id();
  }

  @HostListener("input")
  onInput() {
    this.ngControl?.control?.markAsUntouched();
  }

  get hasError() {
    if (this.showErrorsWhenDisabled()) {
      return !!(
        (this.ngControl?.status === "INVALID" || this.ngControl?.status === "DISABLED") &&
        this.ngControl?.touched &&
        this.ngControl?.errors != null
      );
    } else {
      return !!(this.ngControl?.status === "INVALID" && this.ngControl?.touched);
    }
  }

  get error(): [string, any] {
    const errors = this.ngControl.errors ?? {};
    const key = Object.keys(errors)[0];
    return [key, errors[key]];
  }

  constructor(
    @Optional() @Self() private ngControl: NgControl,
    private ngZone: NgZone,
    private elementRef: ElementRef<HTMLInputElement>,
    @Optional() private parentFormField: BitFormFieldComponent,
  ) {}

  focus() {
    this.ngZone.runOutsideAngular(() => {
      const end = this.elementRef.nativeElement.value.length;
      this.elementRef.nativeElement.setSelectionRange(end, end);
      this.elementRef.nativeElement.focus();
    });
  }

  get readOnly(): boolean {
    return this.elementRef.nativeElement.readOnly;
  }

  get standaloneInputClasses() {
    return [
      "tw-px-3",
      "tw-py-2",
      "tw-rounded-lg",
      // Hover
      this.hasError ? "hover:tw-border-danger-700" : "hover:tw-border-primary-600",
      // Focus
      "focus:hover:tw-border-primary-600",
      "disabled:tw-bg-secondary-100",
      "disabled:hover:tw-border-secondary-500",
      "focus:tw-border-primary-600",
      "focus:tw-ring-1",
      "focus:tw-ring-inset",
      "focus:tw-ring-primary-600",
      "focus:tw-z-10",
    ];
  }
}
