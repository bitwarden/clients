import {
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  NgZone,
  Optional,
  Self,
  SkipSelf,
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

function standaloneInputClasses(error: boolean) {
  return [
    "tw-px-3",
    "tw-py-2",
    "tw-rounded-lg",
    // Hover
    error ? "hover:tw-border-danger-700" : "hover:tw-border-primary-500",
    // Focus
    "focus:hover:tw-border-primary-500",
    "disabled:tw-bg-secondary-100",
    "disabled:hover:tw-border-secondary-500",
    "focus:tw-border-primary-500",
    "focus:tw-ring-1",
    "focus:tw-ring-inset",
    "focus:tw-ring-primary-500",
    "focus:tw-z-10",
  ];
}

@Directive({
  selector: "input[bitInput], select[bitInput], textarea[bitInput]",
  providers: [{ provide: BitFormFieldControl, useExisting: BitInputDirective }],
})
export class BitInputDirective implements BitFormFieldControl {
  @HostBinding("class") @Input() get classList() {
    const classes = [
      "tw-block",
      "tw-w-full",
      "tw-h-full",
      "tw-text-main",
      "tw-placeholder-text-muted",
      "tw-bg-background",
      "tw-border-none",
      "focus:tw-outline-none",
      "[&:is(input,textarea):read-only]:tw-bg-secondary-100",
    ];

    if (this.parentFormField === null) {
      classes.push(...inputBorderClasses(this.hasError), ...standaloneInputClasses(this.hasError));
    }

    return classes.filter((s) => s != "");
  }

  @HostBinding() @Input() id = `bit-input-${nextId++}`;

  @HostBinding("attr.aria-describedby") ariaDescribedBy: string;

  @HostBinding("attr.aria-invalid") get ariaInvalid() {
    return this.hasError ? true : undefined;
  }

  @HostBinding("attr.type") @Input() type?: InputTypes;

  @HostBinding("attr.spellcheck") @Input() spellcheck?: boolean;

  @HostBinding()
  @Input()
  get required() {
    return this._required ?? this.ngControl?.control?.hasValidator(Validators.required) ?? false;
  }
  set required(value: any) {
    this._required = value != null && value !== false;
  }
  private _required: boolean;

  @Input() hasPrefix = false;
  @Input() hasSuffix = false;

  @Input() showErrorsWhenDisabled? = false;

  get labelForId(): string {
    return this.id;
  }

  @HostListener("input")
  onInput() {
    this.ngControl?.control?.markAsUntouched();
  }

  get hasError() {
    if (this.showErrorsWhenDisabled) {
      return (
        (this.ngControl?.status === "INVALID" || this.ngControl?.status === "DISABLED") &&
        this.ngControl?.touched &&
        this.ngControl?.errors != null
      );
    } else {
      return this.ngControl?.status === "INVALID" && this.ngControl?.touched;
    }
  }

  get error(): [string, any] {
    const key = Object.keys(this.ngControl.errors)[0];
    return [key, this.ngControl.errors[key]];
  }

  constructor(
    @Optional() @Self() private ngControl: NgControl,
    private ngZone: NgZone,
    private elementRef: ElementRef<HTMLInputElement>,
    @Optional() @SkipSelf() private parentFormField: BitFormFieldComponent,
  ) {}

  focus() {
    this.ngZone.runOutsideAngular(() => {
      const end = this.elementRef.nativeElement.value.length;
      this.elementRef.nativeElement.setSelectionRange(end, end);
      this.elementRef.nativeElement.focus();
    });
  }
}
