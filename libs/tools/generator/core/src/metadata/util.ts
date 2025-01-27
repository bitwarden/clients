import { AlgorithmsByType } from "./data";
import { CoreProfileMetadata, ExtensionProfileMetadata, ProfileMetadata } from "./profile-metadata";
import {
  CredentialAlgorithm,
  EmailAlgorithm,
  ForwarderExtensionId,
  PasswordAlgorithm,
  UsernameAlgorithm,
} from "./type";

/** Returns true when the input algorithm is a password algorithm. */
export function isPasswordAlgorithm(
  algorithm: CredentialAlgorithm,
): algorithm is PasswordAlgorithm {
  return AlgorithmsByType.password.includes(algorithm as any);
}

/** Returns true when the input algorithm is a username algorithm. */
export function isUsernameAlgorithm(
  algorithm: CredentialAlgorithm,
): algorithm is UsernameAlgorithm {
  return AlgorithmsByType.username.includes(algorithm as any);
}

/** Returns true when the input algorithm is a forwarder integration. */
export function isForwarderExtensionId(
  algorithm: CredentialAlgorithm,
): algorithm is ForwarderExtensionId {
  return algorithm && typeof algorithm === "object" && "forwarder" in algorithm;
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
): value is ExtensionProfileMetadata<Options, "forwarder"> {
  return value.type === "extension" && value.site === "forwarder";
}
