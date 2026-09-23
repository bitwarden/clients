import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/logging";

import {
  AutofillUserVerificationCommand,
  AutofillUserVerificationParams,
} from "../models/autofill-user-verification.command";

import {
  DesktopFido2UserVerificationService,
  Fido2UserVerificationOperation,
  Fido2UserVerificationRequest,
  UserVerificationCanceled,
} from "./desktop-fido2-user-verification.service.abstraction";

/**
 * Runs the native `userVerification` command, leaving each platform to supply
 * the parameters and prompt text that its OS expects.
 */
export abstract class DesktopFido2UserVerificationServiceBase implements DesktopFido2UserVerificationService {
  /** Prefix identifying this implementation in logs. */
  protected abstract readonly logPrefix: string;

  constructor(
    protected readonly i18nService: I18nService,
    protected readonly logService: LogService,
  ) {}

  async verify(
    request: Fido2UserVerificationRequest,
    // No platform exposes a way to dismiss its prompt programmatically yet, so
    // an abort during verification is only observed once the prompt returns.
    _options: { signal: AbortSignal },
  ): Promise<boolean> {
    const result = await ipc.autofill.desktopAutofill.runCommand<AutofillUserVerificationCommand>({
      namespace: "autofill",
      command: "userVerification",
      params: this.buildParams(request),
    });

    if (result.type === "error") {
      this.logService.error(this.logPrefix, "User verification failed", result.error);
      return false;
    }

    if (result.value.outcome === "verified") {
      return true;
    }

    if (result.value.outcome === "cancelled") {
      this.logService.info(this.logPrefix, "The user dismissed the user verification prompt");
      throw new UserVerificationCanceled();
    }

    this.logService.error(
      this.logPrefix,
      "User verification returned with unexpected response",
      result,
    );
    throw new Error("Unexpected user verification response");
  }

  /** Builds the platform-specific parameters for the native command. */
  protected abstract buildParams(
    request: Fido2UserVerificationRequest,
  ): AutofillUserVerificationParams;

  /** The message key holding this platform's prompt text for `operation`. */
  protected abstract messageKey(operation: Fido2UserVerificationOperation): string;

  /** The prompt text the OS displays to the user. */
  protected displayHint(request: Fido2UserVerificationRequest): string {
    return this.i18nService.t(this.messageKey(request.operation), request.rpId, request.username);
  }
}
