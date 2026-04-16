import {
  booleanAttribute,
  computed,
  contentChild,
  Directive,
  inject,
  input,
  signal,
} from "@angular/core";
import { NgControl } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { BitFormControlAbstraction } from "./form-control.abstraction";

let nextId = 0;

@Directive({
  selector: "[bitFormControlBase]",
  host: {
    "[class]": "hostClasses()",
  },
})
export class FormControlBaseDirective {
  readonly id = `bit-form-control-${++nextId}`;
  readonly label = input<string>();

  readonly inline = input(false, { transform: booleanAttribute });

  readonly disableMargin = input(false, { transform: booleanAttribute });
  readonly disableMarginSignal = signal(false);

  private readonly computedDisableMargin = computed(
    () => this.disableMargin() || this.disableMarginSignal(),
  );

  protected readonly hostClasses = computed(() => [
    ...(this.inline() ? ["tw-inline-block", "tw-me-4"] : ["tw-block"]),
    ...(this.computedDisableMargin() ? [] : ["tw-mb-4"]),
  ]);

  readonly formControl = contentChild.required(BitFormControlAbstraction);
  readonly ngControl = contentChild(NgControl);

  readonly inputId = computed(() => this.formControl().inputId);

  private i18nService = inject(I18nService);

  get displayError() {
    const error = this.formControl().error;
    switch (error[0]) {
      case "required":
        return this.i18nService.t("inputRequired");
      default:
        if (error[1]?.message) {
          return error[1]?.message;
        }
        return error;
    }
  }
}
