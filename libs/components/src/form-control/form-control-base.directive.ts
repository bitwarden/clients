import {
  booleanAttribute,
  contentChild,
  Directive,
  effect,
  ElementRef,
  HostBinding,
  inject,
  input,
  signal,
} from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitFormControlAbstraction } from "./form-control.abstraction";

let nextId = 0;

@Directive({
  selector: "[bitFormControlBase]",
})
export class FormControlBaseDirective {
  readonly id = `bit-form-control-${++nextId}`;
  readonly label = input<string>();

  readonly inline = input(false, { transform: booleanAttribute });

  readonly disableMargin = input(false, { transform: booleanAttribute });

  readonly formControl = contentChild.required(BitFormControlAbstraction);
  readonly formControlEl = contentChild.required(BitFormControlAbstraction, { read: ElementRef });

  readonly inputId = signal(this.id);

  @HostBinding("class") get classes() {
    return ([] as string[])
      .concat(this.inline() ? ["tw-inline-block", "tw-me-4"] : ["tw-block"])
      .concat(this.disableMargin() ? [] : ["tw-mb-4"]);
  }

  private i18nService = inject(I18nService);

  constructor() {
    effect(() => {
      const control = this.formControl();
      const el = this.formControlEl().nativeElement;

      if (control.inputId != null) {
        this.inputId.set(control.inputId);
        return;
      }

      const existingId = el.getAttribute("id");
      if (existingId) {
        this.inputId.set(existingId);
      } else {
        el.id = this.id;
      }
    });
  }

  get required() {
    return this.formControl().required;
  }

  get hasError() {
    return this.formControl().hasError;
  }

  get error() {
    return this.formControl().error;
  }

  get displayError() {
    switch (this.error[0]) {
      case "required":
        return this.i18nService.t("inputRequired");
      default:
        // Attempt to show a custom error message.
        if (this.error[1]?.message) {
          return this.error[1]?.message;
        }

        return this.error;
    }
  }
}
