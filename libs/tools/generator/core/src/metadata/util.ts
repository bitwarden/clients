import { VendorId } from "@bitwarden/common/tools/extension";

import { AlgorithmsByType } from "./data";
import { CoreProfileMetadata, ForwarderProfileMetadata, ProfileMetadata } from "./profile-metadata";
import {
  CredentialAlgorithm,
  EmailAlgorithm,
  ForwarderExtensionId,
  PasswordAlgorithm,
  UsernameAlgorithm,
} from "./type";

/** Returns true when the input algorithm is a password algorithm. */
export function isPasswordAlgorithm(
  algorithm: CredentialAlgorithm | null,
): algorithm is PasswordAlgorithm {
  return AlgorithmsByType.password.includes(algorithm as any);
}

/** Returns true when the input algorithm is a username algorithm. */
export function isUsernameAlgorithm(
  algorithm: CredentialAlgorithm | null,
): algorithm is UsernameAlgorithm {
  return AlgorithmsByType.username.includes(algorithm as any);
}

/** Returns true when the input algorithm is a forwarder integration. */
export function isForwarderExtensionId(
  algorithm: CredentialAlgorithm | null,
): algorithm is ForwarderExtensionId {
  return !!(algorithm && typeof algorithm === "object" && "forwarder" in algorithm);
}

/** Extract a `VendorId` from a `CredentialAlgorithm`.
 *  @param algorithm the algorithm containing the vendor id
 *  @returns the vendor id if the algorithm identifies a forwarder extension.
 *   Otherwise, undefined.
 */
export function toVendorId(algorithm: CredentialAlgorithm): VendorId | undefined {
  if (isForwarderExtensionId(algorithm)) {
    return algorithm.forwarder as VendorId;
  }
}

/** Returns true when the input algorithm is an email algorithm. */
export function isEmailAlgorithm(algorithm: CredentialAlgorithm): algorithm is EmailAlgorithm {
  return AlgorithmsByType.email.includes(algorithm as any) || isForwarderExtensionId(algorithm);
}

/** Returns true when the algorithms are the same. */
export function isSameAlgorithm(lhs: CredentialAlgorithm, rhs: CredentialAlgorithm) {
  if (lhs === rhs) {
    return true;
  } else if (isForwarderExtensionId(lhs) && isForwarderExtensionId(rhs)) {
    return lhs.forwarder === rhs.forwarder;
  } else {
    return false;
  }
}

/** Returns true when the input describes a core profile. */
export function isCoreProfile<Options>(
  value: ProfileMetadata<Options>,
): value is CoreProfileMetadata<Options> {
  return value.type === "core";
}

/** Returns true when the input describes a forwarder extension profile. */
export function isForwarderProfile<Options>(
  value: ProfileMetadata<Options>,
): value is ForwarderProfileMetadata<Options> {
  return value.type === "extension" && value.site === "forwarder";
}
