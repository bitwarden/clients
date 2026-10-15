import type { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { unsafeUrlReason } from "@bitwarden/common/tools/url-safety";

/**
 * Rejects a self-hosted forwarder base URL that can't be parsed as a url at all.
 *
 * A well-formed but unsafe url (wrong scheme, or a private/loopback/link-local host) is
 * deliberately NOT a form error here — per the design, that case is handled entirely by an
 * imperative "Trust URL" confirmation dialog, not by inline form validation.
 */
export function urlSafetyValidator(i18nService: I18nService): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;
    if (!value) {
      return null;
    }

    const unsafe = unsafeUrlReason(value);
    if (unsafe?.code !== "invalid") {
      return null;
    }

    return { unsafeUrl: { code: unsafe.code, message: i18nService.t("forwarderMalformedUrl") } };
  };
}
