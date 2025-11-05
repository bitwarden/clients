import { Directive, ElementRef, forwardRef, HostListener, Input, Renderer2 } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

// ref: https://juristr.com/blog/2018/02/ng-true-value-directive/
@Directive({
  selector: "input[type=checkbox][appTrueFalseValue]",
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TrueFalseValueDirective),
      multi: true,
    },
  ],
  standalone: false,
})
export class TrueFalseValueDirective implements ControlValueAccessor {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() trueValue: boolean | string = true;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() falseValue: boolean | string = false;

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2,
  ) {}

  @HostListener("change", ["$event"])
  onHostChange(ev: any) {
    this.propagateChange(ev.target.checked ? this.trueValue : this.falseValue);
  }

  writeValue(obj: any): void {
    if (obj === this.trueValue) {
      this.renderer.setProperty(this.elementRef.nativeElement, "checked", true);
    } else {
      this.renderer.setProperty(this.elementRef.nativeElement, "checked", false);
    }
  }

  registerOnChange(fn: any): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: any): void {
    /* nothing */
  }

  setDisabledState?(isDisabled: boolean): void {
    /* nothing */
  }

  private propagateChange = (_: any) => {
    /* nothing */
  };
}
