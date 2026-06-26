import { Directive, forwardRef, input } from "@angular/core";
import { AbstractControl, NgControl } from "@angular/forms";

/**
 * Provides an `NgControl` proxy on its host element for components that need to expose
 * a consumer-bound `AbstractControl` to a content-projected `BitFormFieldControlDirective`
 * without going through Angular's reactive-forms binding pipeline.
 *
 * Reactive forms' `[formControl]` registers the bound control with `setUpControl`, which
 * **replaces** the control's validators with the directive's (empty) validator set and
 * triggers `updateValueAndValidity()` — clobbering any pre-set errors or validators on the
 * consumer's control. That's a deal-breaker when the directive is being applied to a
 * "ghost" element solely to satisfy `bit-form-field`'s `contentChild.required(BitFormFieldControlDirective)`
 * while the actual control lives on a parent component.
 *
 * This proxy provides `NgControl` via the element's injector. Its `control` getter returns
 * the bound source control, so `BitFormFieldControlDirective` reads its `status`, `touched`,
 * `errors`, and `required` directly from the consumer's control. No `setUpControl` is
 * triggered.
 */
@Directive({
  selector: "[bitFormControlProxy]",
  providers: [{ provide: NgControl, useExisting: forwardRef(() => BitFormControlProxyDirective) }],
})
export class BitFormControlProxyDirective extends NgControl {
  readonly source = input.required<AbstractControl | null>({ alias: "bitFormControlProxy" });

  override get control(): AbstractControl | null {
    return this.source();
  }

  override viewToModelUpdate(): void {
    // No-op: this proxy is read-only. Value changes flow through the parent component's
    // ControlValueAccessor implementation, not through Angular's form-binding pipeline.
  }
}
