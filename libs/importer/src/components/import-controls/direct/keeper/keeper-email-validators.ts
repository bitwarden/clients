import { ValidatorFn, Validators } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

/** Keeper's email field uses the design's copy rather than the generic messages. */
export function keeperEmailRequiredValidator(i18nService: I18nService): ValidatorFn {
  return (control) =>
    (control.value ?? "").trim().length > 0
      ? null
      : { keeperEmailRequired: { message: i18nService.t("keeperLoginEmailRequired") } };
}

export function keeperEmailFormatValidator(i18nService: I18nService): ValidatorFn {
  return (control) =>
    Validators.email(control) == null
      ? null
      : { keeperEmailInvalid: { message: i18nService.t("keeperLoginEmailInvalid") } };
}
