import { MacOsAutofillUserVerificationParams } from "../models/autofill-user-verification.command";

import {
  Fido2UserVerificationOperation,
  Fido2UserVerificationRequest,
} from "./desktop-fido2-user-verification.service.abstraction";
import { DesktopFido2UserVerificationServiceBase } from "./desktop-fido2-user-verification.service.base";

/**
 * Verifies the user with Touch ID or the device password through
 * `LocalAuthentication`.
 *
 * See `apps/desktop/desktop_native/objc/src/native/autofill/commands/user_verification.m`
 * for the native implementation.
 */
export class DesktopFido2MacOsUserVerificationService extends DesktopFido2UserVerificationServiceBase {
  protected readonly logPrefix = "[DesktopFido2MacOsUserVerificationService]";

  /** macOS attaches the prompt to the active application, not to a window. */
  protected buildParams(
    request: Fido2UserVerificationRequest,
  ): MacOsAutofillUserVerificationParams {
    return {
      username: request.username,
      displayHint: this.displayHint(request),
    };
  }

  protected messageKey(operation: Fido2UserVerificationOperation): string {
    return {
      registration: "confirmPasskeyRegistrationMacOS",
      overwrite: "confirmPasskeyOverwriteMacOS",
      assertion: "confirmPasskeyAssertionMacOS",
    }[operation];
  }
}
