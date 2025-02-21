// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, HostBinding, Input } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

// Increments for each instance of this component
let nextId = 0;

@Component({
  selector: "bit-error",
  template: `<i class="bwi bwi-error"></i> {{ displayError }}`,
  host: {
    class: "tw-block tw-mt-1 tw-text-danger tw-text-xs",
    "aria-live": "assertive",
  },
  standalone: true,
})
export class BitErrorComponent {
  @HostBinding() id = `bit-error-${nextId++}`;

  @Input() error: [string, any];

  constructor(private i18nService: I18nService) {}

  get displayError() {
    switch (this.error[0]) {
      case "required":
        return this.i18nService.t("inputRequired");
      case "email":
        return this.i18nService.t("inputEmail");
      case "minlength":
        return this.i18nService.t("inputMinLength", this.error[1]?.requiredLength);
      case "maxlength":
        return this.i18nService.t("inputMaxLength", this.error[1]?.requiredLength);
      case "min":
        return this.i18nService.t("inputMinValue", this.error[1]?.min);
      case "max":
        return this.i18nService.t("inputMaxValue", this.error[1]?.max);
      case "forbiddenCharacters":
        return this.i18nService.t("inputForbiddenCharacters", this.error[1]?.characters.join(", "));
      case "multipleEmails":
        return this.i18nService.t("multipleInputEmails");
      case "trim":
        return this.i18nService.t("inputTrimValidator");
      default:
        // Attempt to show a custom error message.
        if (this.error[1]?.message) {
          return this.error[1]?.message;
        }

        return this.error;
    }
  }
}
