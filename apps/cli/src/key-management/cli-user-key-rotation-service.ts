import { KeyRotationMethod } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";
import {
  TrustVerificationResult,
  UserKeyRotationServiceAbstraction,
} from "@bitwarden/user-crypto-management";

/**
 * CLI stub for {@link UserKeyRotationServiceAbstraction}. The CLI does not run
 * any encrypted migrations that depend on key rotation, so all methods throw.
 */
export class CliUserKeyRotationService extends UserKeyRotationServiceAbstraction {
  changePasswordAndRotateUserKey(
    _currentMasterPassword: string,
    _newMasterPassword: string,
    _hint: string | undefined,
    _userId: UserId,
  ): Promise<boolean> {
    throw new Error("User key rotation is not supported on the CLI.");
  }

  rotateUserKey(
    _keyRotationMethod: KeyRotationMethod,
    _upgradeTokenAction: "CreateIfNeeded" | "Skip",
    _userId: UserId,
  ): Promise<boolean> {
    throw new Error("User key rotation is not supported on the CLI.");
  }

  verifyTrust(_userId: UserId): Promise<TrustVerificationResult> {
    throw new Error("User key rotation trust verification is not supported on the CLI.");
  }
}
