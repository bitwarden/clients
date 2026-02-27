import { CipherRepromptType as SdkCipherRepromptType } from "@bitwarden/sdk-internal";

import { UnionOfValues } from "../types/union-of-values";

export const CipherRepromptType = {
  None: 0,
  Password: 1,
} as const;

export type CipherRepromptType = UnionOfValues<typeof CipherRepromptType>;

/**
 * Normalizes a CipherRepromptType value to ensure compatibility with the SDK.
 * @param value - The cipher reprompt type from user data
 * @returns Valid CipherRepromptType, defaults to CipherRepromptType.None if unrecognized
 */
export function normalizeCipherRepromptTypeForSdk(
  value: CipherRepromptType,
): SdkCipherRepromptType {
  switch (value) {
    case CipherRepromptType.None:
    case CipherRepromptType.Password:
      return value;
    default:
      return CipherRepromptType.None;
  }
}
