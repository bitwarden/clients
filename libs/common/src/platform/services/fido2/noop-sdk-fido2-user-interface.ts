import {
  CheckUserAndPickCredentialForCreationResult,
  CheckUserResult,
  Fido2UserInterface,
  CipherView,
} from "@bitwarden/sdk-internal";

import { LogService } from "../../abstractions/log.service";

/**
 * A {@link Fido2UserInterface} for silent operations, which must never prompt the user.
 *
 * `silently_discover_credentials` never calls the user interface today, so none of these methods
 * run. Each logs a warning if called, turning that invariant into a runtime tripwire: a warning here
 * means an SDK change started prompting on a silent path.
 *
 * `check_user` declines. The two `pick_*` methods reject instead, because whatever they resolve with
 * becomes the selected credential — there is no value that picks nothing.
 */
export class NoopSdkFido2UserInterface implements Fido2UserInterface {
  constructor(private logService: LogService) {}

  async check_user(): Promise<CheckUserResult> {
    this.warnInvoked("check_user");
    return { userPresent: false, userVerified: false };
  }

  async pick_credential_for_authentication(): Promise<CipherView> {
    throw new Error(this.warnInvoked("pick_credential_for_authentication"));
  }

  async check_user_and_pick_credential_for_creation(): Promise<CheckUserAndPickCredentialForCreationResult> {
    throw new Error(this.warnInvoked("check_user_and_pick_credential_for_creation"));
  }

  private warnInvoked(method: string): string {
    const message =
      `NoopSdkFido2UserInterface.${method} was invoked on a silent FIDO2 operation, ` +
      "which must not prompt the user. The operation will not complete.";
    this.logService.warning(message);
    return message;
  }
}
