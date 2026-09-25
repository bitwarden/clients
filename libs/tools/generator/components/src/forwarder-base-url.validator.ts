import type { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { unsafeUrlReason } from "@bitwarden/common/tools/url-safety";

/**
 * Rejects a self-hosted forwarder base URL that isn't https or targets a local/private host.
 *
 * @param isOverridden reports whether the user has deliberately approved the current value via
 *  the "allow unsafe url" disclaimer checkbox. Only waives the scheme/host rejection — a url
 *  that can't be parsed at all is always rejected, override or not.
 */
export function urlSafetyValidator(
  i18nService: I18nService,
  isOverridden: () => boolean = () => false,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;
    if (!value) {
      return null;
    }

    const unsafe = unsafeUrlReason(value);
    if (!unsafe) {
      return null;
    }

    if (unsafe.code !== "invalid" && isOverridden()) {
      return null;
    }

    const messageKey = unsafe.code === "invalid" ? "forwarderMalformedUrl" : "forwarderUnsafeUrl";
    return { unsafeUrl: { code: unsafe.code, message: i18nService.t(messageKey) } };
  };
}
