import { LogService } from "@bitwarden/logging";

import { DesktopFido2UserVerificationService } from "./desktop-fido2-user-verification.service.abstraction";

/**
 * Used on platforms with no OS user verification integration.
 *
 * Verification always fails rather than throwing, so ceremonies that require it
 * are rejected by the authenticator while ceremonies that don't are unaffected.
 */
export class DesktopFido2UnsupportedUserVerificationService implements DesktopFido2UserVerificationService {
  constructor(private readonly logService: LogService) {}

  async verify(): Promise<boolean> {
    this.logService.error(
      "[DesktopFido2UnsupportedUserVerificationService]",
      "This platform has no operating system user verification support",
    );
    return false;
  }
}
