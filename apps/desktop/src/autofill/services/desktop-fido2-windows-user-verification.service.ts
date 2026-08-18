import { Utils } from "@bitwarden/common/platform/misc/utils";

import { WindowsAutofillUserVerificationParams } from "../models/autofill-user-verification.command";

import {
  Fido2UserVerificationOperation,
  Fido2UserVerificationRequest,
} from "./desktop-fido2-user-verification.service.abstraction";
import { DesktopFido2UserVerificationServiceBase } from "./desktop-fido2-user-verification.service.base";

/**
 * Verifies the user with Windows Hello through the plugin authenticator API.
 *
 * See `apps/desktop/desktop_native/core/src/autofill/windows/user_verification.rs`
 * for the native implementation.
 */
export class DesktopFido2WindowsUserVerificationService extends DesktopFido2UserVerificationServiceBase {
  protected readonly logPrefix = "[DesktopFido2WindowsUserVerificationService]";

  protected buildParams(
    request: Fido2UserVerificationRequest,
  ): WindowsAutofillUserVerificationParams {
    if (!request.windowHandle) {
      // The handle is optional in the abstraction because not every platform
      // attaches its prompt to a window. Windows always does, so an absent
      // handle here is a programming error rather than a runtime condition.
      throw new Error("Cannot perform user verification: the request has no window handle");
    }

    return {
      username: request.username,
      displayHint: this.displayHint(request),
      windowHandle: Utils.fromArrayToB64(request.windowHandle),
      transactionContext: request.requestContext,
    };
  }

  protected messageKey(operation: Fido2UserVerificationOperation): string {
    return {
      registration: "confirmPasskeyRegistrationWindows",
      overwrite: "confirmPasskeyOverwriteWindows",
      assertion: "confirmPasskeyAssertionWindows",
    }[operation];
  }
}
