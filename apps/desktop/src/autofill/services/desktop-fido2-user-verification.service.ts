import { Fido2UserVerificationService } from "@bitwarden/common/platform/abstractions/fido2/fido2-user-interface.service.abstraction";
import { LogService } from "@bitwarden/logging";

import { NativeAutofillUserVerificationCommand } from "../../platform/main/autofill/user-verification.command";

export class MacOsFido2UserVerificationService implements Fido2UserVerificationService {
  constructor(private readonly logService: LogService) {}

  async promptForUserVerification(
    operation: "registration" | "overwrite" | "assertion",
    username: string,
    _context?: void,
  ): Promise<boolean> {
    // TODO: internationalization
    const displayHint = {
      registration: "verify it's you to create a new credential",
      overwrite: "verify it's you to overwrite a credential",
      assertion: "verify it's you to log in",
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
