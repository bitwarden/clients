import { NgClass } from "@angular/common";
import { booleanAttribute, Component, HostBinding, input, contentChild } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { I18nPipe } from "@bitwarden/ui-common";

import { TypographyDirective } from "../typography/typography.directive";

import { BitFormControlAbstraction } from "./form-control.abstraction";

@Component({
  selector: "bit-form-control",
  templateUrl: "form-control.component.html",
  imports: [NgClass, TypographyDirective, I18nPipe],
})
export class FormControlComponent {
  readonly label = input<string>();

  readonly inline = input(false, { transform: booleanAttribute });

  readonly disableMargin = input(false, { transform: booleanAttribute });

  protected readonly formControl = contentChild.required(BitFormControlAbstraction);

  @HostBinding("class") get classes() {
    return ([] as string[])
      .concat(this.inline() ? ["tw-inline-block", "tw-me-4"] : ["tw-block"])
      .concat(this.disableMargin() ? [] : ["tw-mb-4"]);
  }

  constructor(private i18nService: I18nService) {}

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
