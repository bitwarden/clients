import { Fido2UserVerificationService } from "@bitwarden/common/platform/abstractions/fido2/fido2-user-interface.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/logging";

import { NativeAutofillUserVerificationCommand } from "../../platform/main/autofill/user-verification.command";

export class MacOsFido2UserVerificationService implements Fido2UserVerificationService {
  constructor(
    private readonly i18nService: I18nService,
    private readonly logService: LogService,
  ) {}

  async promptForUserVerification(
    operation: "registration" | "overwrite" | "assertion",
    username: string,
    _context?: void,
  ): Promise<boolean> {
    const displayHint = {
      registration: this.i18nService.translate("confirmPasskeyRegistrationMacOS"),
      overwrite: this.i18nService.translate("confirmPasskeyOverwriteMacOS"),
      assertion: this.i18nService.translate("confirmPasskeyAssertionMacOS"),
    }[operation];

    const uvResult = await ipc.autofill.runCommand<NativeAutofillUserVerificationCommand>({
      namespace: "autofill",
      command: "user-verification",
      params: {
        username,
        displayHint,
        windowHandle: undefined,
        transactionContext: undefined,
      },
    });
    if (uvResult.type === "error") {
      this.logService.error("Error getting user verification", uvResult.error);
      return false;
    }
    return uvResult.type === "success";
  }
}
