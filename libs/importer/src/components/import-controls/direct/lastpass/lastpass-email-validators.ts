import { ValidatorFn, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

/** LastPass's email field uses the design's copy rather than the generic messages. */
export function lastPassEmailRequiredValidator(i18nService: I18nService): ValidatorFn {
  return (control) =>
    (control.value ?? "").trim().length > 0
      ? null
      : { lastPassEmailRequired: { message: i18nService.t("lastPassLoginEmailRequired") } };
}

export function lastPassEmailFormatValidator(i18nService: I18nService): ValidatorFn {
  return (control) =>
    Validators.email(control) == null
      ? null
      : { lastPassEmailInvalid: { message: i18nService.t("lastPassLoginEmailInvalid") } };
}
