import {
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  NgZone,
  Optional,
  Self,
} from "@angular/core";
import { NgControl, Validators } from "@angular/forms";

import { BitFormFieldControl, InputTypes } from "../form-field/form-field-control";

// Increments for each instance of this component
let nextId = 0;

@Directive({
  selector: "input[bitInput], select[bitInput], textarea[bitInput]",
  providers: [{ provide: BitFormFieldControl, useExisting: BitInputDirective }],
})
export class BitInputDirective implements BitFormFieldControl {
  @HostBinding("class") @Input() get classList() {
    return [
      "tw-block",
      "tw-w-full",
      "tw-px-3",
      "tw-py-1.5",
      "tw-bg-background-alt",
      "tw-border",
      "tw-border-solid",
      this.hasError ? "tw-border-danger-500" : "tw-border-secondary-500",
      "tw-text-main",
      "tw-placeholder-text-muted",
      // Rounded
      "tw-rounded-none",
      "first:tw-rounded-l",
      "last:tw-rounded-r",
      // Focus
      "focus:tw-outline-none",
      "focus:tw-border-primary-700",
      "focus:tw-ring-1",
      "focus:tw-ring-inset",
      "focus:tw-ring-primary-700",
      "focus:tw-z-10",
      "disabled:tw-bg-secondary-100",
      "[&:is(input,textarea):read-only]:tw-bg-secondary-100",
    ].filter((s) => s != "");
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
    private elementRef: ElementRef<HTMLInputElement>
  ) {}

  focus() {
    this.ngZone.runOutsideAngular(() => {
      const end = this.elementRef.nativeElement.value.length;
      this.elementRef.nativeElement.setSelectionRange(end, end);
      this.elementRef.nativeElement.focus();
    });
  }
}
